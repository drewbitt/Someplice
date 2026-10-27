import { afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, setDb } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import { createCallerFactory, router } from './router';

let db: ReturnType<typeof createDb>;
const caller = createCallerFactory(router)({});
interface Pagination {
	limit?: number;
	offset?: number;
}
const range = {
	startDate: new Date('2026-01-01T00:00:00Z'),
	endDate: new Date('2026-01-03T00:00:00Z')
};
const lists = [
	['intentions', (input: Pagination) => caller.intentions.list(input)],
	[
		'intentions by date',
		async (input: Pagination) =>
			Object.values(await caller.intentions.listByDate({ ...range, ...input })).flat()
	],
	['intention dates', (input: Pagination) => caller.intentions.listUniqueDates(input)],
	['outcomes', (input: Pagination) => caller.outcomes.list(input)],
	['completed priorities', (input: Pagination) => caller.priorities.listCompleted(input)]
] as const;

beforeEach(async () => {
	db = createDb(':memory:');
	setDb(db);
	await runMigrations(db);
	await db
		.insertInto('goals')
		.values({ id: 1, active: 1, orderNumber: 1, title: 'Read', color: 'navy' })
		.execute();
	for (const date of ['2026-01-01', '2026-01-02', '2026-01-03']) {
		const timestamp = `${date}T12:00:00.000Z`;
		await db
			.insertInto('intentions')
			.values({ goalId: 1, orderNumber: 1, status: 'pending', text: 'Read', date: timestamp })
			.execute();
		await db.insertInto('outcomes').values({ date, reviewed: 1 }).execute();
		await db
			.insertInto('priorities')
			.values({ goalId: 1, text: 'Read', createdAt: timestamp, completedAt: timestamp })
			.execute();
	}
});
afterEach(async () => db.destroy());

test.each(lists)('%s respects zero limits and offset-only pagination', async (_, list) => {
	const all = await list({});
	expect(all).toHaveLength(3);
	expect(await list({ limit: 0 })).toEqual([]);
	expect(await list({ limit: 0, offset: 1 })).toEqual([]);
	expect(await list({ offset: 0 })).toEqual(all);
	expect(await list({ offset: 1 })).toEqual(all.slice(1));
	expect(await list({ limit: 1, offset: 1 })).toEqual(all.slice(1, 2));
	expect(await list({ offset: 99 })).toEqual([]);
});

test.each(lists)(
	'%s rejects negative and fractional pagination with BAD_REQUEST',
	async (_, list) => {
		for (const input of [{ limit: -1 }, { offset: -1 }, { limit: 0.5 }, { offset: 0.5 }]) {
			await expect(list(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		}
	}
);
