import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { createDb, getDb, setDb } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import { setSetting } from '#lib/db/queries.js';
import { createCallerFactory, router } from '../router.js';

const caller = createCallerFactory(router)({});
const preferences = {
	workMinutes: 25,
	hourglassMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 20
};
const start = (
	kind: 'pomodoro' | 'hourglass' | 'break' = 'pomodoro',
	intentionId: number | null = null,
	id = randomUUID()
) => caller.focus.start({ id, kind, intentionId, minutes: 25, preferences });
const advance = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000);

describe('focus sessions', () => {
	beforeEach(async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-11-08T17:00:00.000Z'));
		setDb(createDb(':memory:'));
		await runMigrations(getDb());
		await setSetting(getDb(), 'timezone', 'UTC');
	});
	afterEach(async () => {
		vi.useRealTimers();
		await getDb().destroy();
	});

	async function addIntention(day = '2026-11-08') {
		const goal = await caller.goals.add({
			active: 1,
			title: 'Read',
			description: null,
			color: 'navy'
		});
		return (
			await getDb()
				.insertInto('intentions')
				.values({
					goalId: goal.id!,
					status: 'pending',
					orderNumber: 1,
					text: 'Read chapter one',
					date: `${day}T12:00:00.000Z`
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id!;
	}

	it('starts against a stable intention, preserving preferences independently of task completion', async () => {
		const id = await addIntention();
		const result = await start('pomodoro', id);
		expect(result.active).toMatchObject({
			intentionId: id,
			intentionText: 'Read chapter one',
			plannedSeconds: 1500,
			status: 'running'
		});
		expect(result.preferences).toEqual(preferences);
		await caller.intentions.setCompletion({ id, completed: true });
		expect((await caller.focus.state()).active?.intentionId).toBe(id);
	});

	it('reconciles expiration once at the deadline after a long sleep without chaining', async () => {
		const id = await addIntention();
		const { active } = await start('pomodoro', id);
		advance(3600 * 12);
		const result = await caller.focus.state();
		expect(result.active).toBeNull();
		expect(result.latest).toMatchObject({
			status: 'completed',
			elapsedSeconds: 1500,
			endedAt: active!.startedAt + 1500_000
		});
		expect((await caller.focus.state()).latest).toEqual(result.latest);
		expect(await getDb().selectFrom('focus_sessions').selectAll().execute()).toHaveLength(1);
		expect(
			await getDb()
				.selectFrom('intentions')
				.select('status')
				.where('id', '=', id)
				.executeTakeFirst()
		).toEqual({ status: 'pending' });
	});

	it('hourglass excludes paused time and records partial work idempotently', async () => {
		const { active } = await start('hourglass');
		advance(120);
		const paused = await caller.focus.control({ id: active!.id, revision: 0, action: 'pause' });
		expect(paused.active).toMatchObject({
			status: 'paused',
			elapsedSeconds: 120,
			lastStartedAt: null
		});
		advance(3600);
		expect((await caller.focus.state()).active?.elapsedSeconds).toBe(120);
		const resumed = await caller.focus.control({ id: active!.id, revision: 1, action: 'resume' });
		advance(30);
		const stopped = await caller.focus.control({
			id: active!.id,
			revision: resumed.active!.revision,
			action: 'stop'
		});
		expect(stopped.latest).toMatchObject({ elapsedSeconds: 150, status: 'completed' });
		expect(stopped.totals).toEqual({ pomodoros: 0, seconds: 150 });
		expect(
			(await caller.focus.control({ id: active!.id, revision: 2, action: 'stop' })).totals
		).toEqual(stopped.totals);
	});

	it('Pomodoro cannot pause or claim partial credit on interruption', async () => {
		const { active } = await start();
		advance(60);
		await expect(
			caller.focus.control({ id: active!.id, revision: 0, action: 'pause' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		await expect(
			caller.focus.control({ id: active!.id, revision: 0, action: 'stop' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		const result = await caller.focus.control({ id: active!.id, revision: 0, action: 'cancel' });
		expect(result.latest).toMatchObject({ status: 'cancelled', elapsedSeconds: 60 });
		expect(result.totals).toEqual({ pomodoros: 0, seconds: 0 });
	});

	it('rejects a second active session and allows retrying the original start', async () => {
		const id = randomUUID();
		await start('pomodoro', null, id);
		await expect(start()).rejects.toMatchObject({ code: 'CONFLICT' });
		advance(300);
		const retried = await start('pomodoro', null, id);
		expect(retried.active?.startedAt).toBe(Date.now() - 300_000);
		expect(await getDb().selectFrom('focus_sessions').select('id').execute()).toHaveLength(1);
	});

	it('concurrent starts leave exactly one active timer', async () => {
		const results = await Promise.allSettled([start(), start()]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(
			await getDb()
				.selectFrom('focus_sessions')
				.select('id')
				.where('status', '=', 'running')
				.execute()
		).toHaveLength(1);
	});

	it('stale tab controls cannot resume or stop a session that has changed', async () => {
		const { active } = await start('hourglass');
		await caller.focus.control({ id: active!.id, revision: 0, action: 'pause' });
		await expect(
			caller.focus.control({ id: active!.id, revision: 0, action: 'stop' })
		).rejects.toMatchObject({ code: 'CONFLICT' });
		expect((await caller.focus.state()).active?.status).toBe('paused');
	});

	it('an old cancel retry cannot stop a newer timer', async () => {
		const { active } = await start();
		await caller.focus.control({ id: active!.id, revision: 0, action: 'cancel' });
		const next = await start();
		const retried = await caller.focus.control({ id: active!.id, revision: 0, action: 'cancel' });
		expect(retried.active?.id).toBe(next.active?.id);
		expect(retried.latest?.id).toBe(next.active?.id);
	});

	it('breaks never contribute work totals', async () => {
		await start('break');
		advance(1500);
		const result = await caller.focus.state();
		expect(result.latest?.status).toBe('completed');
		expect(result.totals).toEqual({ pomodoros: 0, seconds: 0 });
	});

	it('retains day and task snapshot across midnight and task deletion', async () => {
		await setSetting(getDb(), 'timezone', 'America/New_York');
		vi.setSystemTime(new Date('2026-11-09T04:55:00Z'));
		const id = await addIntention();
		await start('pomodoro', id);
		await getDb().deleteFrom('intentions').where('id', '=', id).execute();
		advance(1500);
		const result = await caller.focus.state();
		expect(result.day).toBe('2026-11-09');
		expect(result.latest).toMatchObject({
			day: '2026-11-08',
			intentionId: null,
			intentionText: 'Read chapter one',
			status: 'completed'
		});
		expect(result.totals).toEqual({ pomodoros: 0, seconds: 0 });
	});

	it('rejects stale or unavailable intention choices and invalid durations', async () => {
		const id = await addIntention('2026-11-07');
		await expect(start('pomodoro', id)).rejects.toMatchObject({ code: 'CONFLICT' });
		await expect(
			caller.focus.start({
				id: randomUUID(),
				kind: 'hourglass',
				intentionId: null,
				minutes: 0,
				preferences
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect((await caller.focus.state()).active).toBeNull();
	});

	it('database itself enforces the single active timer rule', async () => {
		const { active } = await start();
		await expect(
			getDb()
				.insertInto('focus_sessions')
				.values({ ...active!, id: randomUUID() })
				.execute()
		).rejects.toThrow();
		expect((await sql`PRAGMA foreign_key_check`.execute(getDb())).rows).toEqual([]);
	});
});
