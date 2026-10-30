import { createDb, getDb, setDb } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import { afterEach, expect, test, vi } from 'vitest';
import { load } from './+page.server';

afterEach(async () => {
	vi.useRealTimers();
	await getDb().destroy();
});

test.each(['UTC', 'America/New_York'])(
	'reviews the past day even when today already has intentions in %s',
	async (timeZone) => {
		setDb(createDb(':memory:'));
		const db = getDb();
		await runMigrations(db);
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-19T04:05:00.000Z'));
		await db.insertInto('settings').values({ key: 'timezone', value: timeZone }).execute();
		await db
			.insertInto('goals')
			.values({ id: 1, title: 'Read', description: '', color: 'navy', active: 1, orderNumber: 1 })
			.execute();
		await db
			.insertInto('intentions')
			.values(
				['2026-10-18', '2026-10-19'].map((date) => ({
					goalId: 1,
					orderNumber: 1,
					status: 'pending' as const,
					text: 'Read a chapter',
					date: `${date}T00:01:00.000Z`
				}))
			)
			.execute();

		const event = {} as Parameters<typeof load>[0];
		const data = await load(event);
		expect(data.today).toBe('2026-10-19');
		expect(data.intentions.map((row) => row.date.slice(0, 10))).toEqual(['2026-10-19']);
		expect(data.intentionsOnLatestDate.map((row) => row.date.slice(0, 10))).toEqual(['2026-10-18']);
		expect(data.hasOutstandingOutcome).toBe(true);

		await db.insertInto('outcomes').values({ date: '2026-10-18', reviewed: 1 }).execute();
		expect((await load(event)).hasOutstandingOutcome).toBe(false);
	}
);

test.each([
	[
		'America/New_York',
		'2026-03-09T03:30:00.000Z',
		'2026-03-08',
		['2026-03-05', '2026-03-06', '2026-03-07']
	],
	[
		'America/New_York',
		'2026-11-02T04:30:00.000Z',
		'2026-11-01',
		['2026-10-29', '2026-10-30', '2026-10-31']
	],
	['UTC', '2026-11-02T04:30:00.000Z', '2026-11-02', ['2026-10-30', '2026-10-31', '2026-11-01']]
] as const)(
	'loads exactly three prior calendar days in %s at %s',
	async (timeZone, instant, today, expectedDays) => {
		setDb(createDb(':memory:'));
		const db = getDb();
		await runMigrations(db);
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(instant));
		await db.insertInto('settings').values({ key: 'timezone', value: timeZone }).execute();
		await db
			.insertInto('goals')
			.values({ id: 1, title: 'Read', description: '', color: 'navy', active: 1, orderNumber: 1 })
			.execute();
		const tooOld = new Date(`${expectedDays[0]}T00:00:00.000Z`);
		tooOld.setUTCDate(tooOld.getUTCDate() - 1);
		const dates = [
			tooOld.toISOString(),
			...expectedDays.map(
				(day, index) => `${day}T${index === 2 ? '23:59:59.999' : '00:00:00.000'}Z`
			),
			`${today}T00:00:00.000Z`
		];
		await db
			.insertInto('intentions')
			.values(
				dates.map((date, index) => ({
					goalId: 1,
					orderNumber: 1,
					status: (['pending', 'pending', 'not_today', 'done', 'pending'] as const)[index],
					text: `Task ${index}`,
					date
				}))
			)
			.execute();
		const event = {} as Parameters<typeof load>[0];
		const data = await load(event);
		expect(data.today).toBe(today);
		expect(data.recentIntentions.map((i) => i.date.slice(0, 10)).sort()).toEqual([...expectedDays]);
		expect(data.recentIntentions.map((i) => i.status).sort()).toEqual([
			'done',
			'not_today',
			'pending'
		]);
		// Reloading after a review returns fresh status in the same data payload.
		await db
			.updateTable('intentions')
			.set({ status: 'done' })
			.where('text', '=', 'Task 2')
			.execute();
		expect((await load(event)).recentIntentions.find((i) => i.text === 'Task 2')?.status).toBe(
			'done'
		);
	}
);
