import { createDb, getDb, setDb } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import type { DB } from '#lib/types/data.js';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

const event = {} as Parameters<typeof load>[0];

describe('Journey server load', () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		setDb(createDb(':memory:'));
		db = getDb();
		await runMigrations(db);
		vi.useFakeTimers({ toFake: ['Date'] });
	});

	afterEach(async () => {
		vi.useRealTimers();
		await db.destroy();
	});

	it.each([
		['Pacific/Kiritimati', '2026-10-04T15:00:00.000Z', '2026-10-05', '2026-10-04'],
		['America/Los_Angeles', '2026-10-04T03:00:00.000Z', '2026-10-03', '2026-10-02']
	])(
		'loads outcome and milestone days without intentions in %s',
		async (timeZone, instant, today, previousDay) => {
			vi.setSystemTime(new Date(instant));
			await db.insertInto('settings').values({ key: 'timezone', value: timeZone }).execute();
			const goal = await db
				.insertInto('goals')
				.values({
					active: 1,
					title: 'Goal',
					description: '',
					color: 'hsl(0, 0%, 50%)',
					orderNumber: 1
				})
				.returning('id')
				.executeTakeFirstOrThrow();
			if (goal.id === null) throw new Error('Goal insert did not return an id');
			await db
				.insertInto('outcomes')
				.values([
					{ date: today, reviewed: 1 },
					{ date: previousDay, reviewed: 1 }
				])
				.execute();
			await db
				.insertInto('priorities')
				.values({
					goalId: goal.id,
					text: 'Completed milestone',
					description: null,
					checkInDate: null,
					createdAt: `${today}T00:00:00.000Z`,
					completedAt: `${today}T00:30:00.000Z`,
					reflection: null
				})
				.execute();

			const data = await load(event);

			expect(data.intentionsByDate).toEqual({});
			expect(data.outcomes.map((outcome) => outcome.date)).toEqual([today, previousDay]);
			expect(data.completedPriorities.map((priority) => priority.text)).toEqual([
				'Completed milestone'
			]);
			expect(data.oldestLoadedDate).toBe(previousDay);
			expect(Object.keys(data.goalsByDate)).toEqual([today, previousDay]);
		}
	);

	it.each([
		['Pacific/Kiritimati', '2026-10-04T15:00:00.000Z', '2026-10-05'],
		['America/Los_Angeles', '2026-10-04T03:00:00.000Z', '2026-10-03']
	])('anchors an empty journey to today in %s', async (timeZone, instant, today) => {
		vi.setSystemTime(new Date(instant));
		await db.insertInto('settings').values({ key: 'timezone', value: timeZone }).execute();

		const data = await load(event);

		expect(data.outcomes).toEqual([]);
		expect(data.completedPriorities).toEqual([]);
		expect(data.oldestLoadedDate).toBe(today);
	});

	it('bounds history without intentions to the newest 15 distinct days', async () => {
		vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
		await db.insertInto('settings').values({ key: 'timezone', value: 'UTC' }).execute();
		await db
			.insertInto('outcomes')
			.values(
				Array.from({ length: 20 }, (_, day) => ({
					date: `2026-10-${String(day + 1).padStart(2, '0')}`,
					reviewed: 1
				}))
			)
			.execute();

		const data = await load(event);

		expect(data.outcomes).toHaveLength(15);
		expect(data.outcomes[0].date).toBe('2026-10-20');
		expect(data.outcomes.at(-1)?.date).toBe('2026-10-06');
		expect(data.oldestLoadedDate).toBe('2026-10-06');
	});
});
