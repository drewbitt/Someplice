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
		expect(data.intentions.map((row) => row.date.slice(0, 10))).toEqual(['2026-10-19']);
		expect(data.intentionsOnLatestDate.map((row) => row.date.slice(0, 10))).toEqual(['2026-10-18']);
		expect(data.hasOutstandingOutcome).toBe(true);

		await db.insertInto('outcomes').values({ date: '2026-10-18', reviewed: 1 }).execute();
		expect((await load(event)).hasOutstandingOutcome).toBe(false);
	}
);
