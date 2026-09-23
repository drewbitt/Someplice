import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Outcome } from '../types';
import { createCallerFactory, router } from '../router';

const TEST_GOAL = {
	active: 1,
	title: 'Test Goal',
	description: 'A goal for testing purposes.',
	color: 'hsl(0, 0%, 50%)',
	orderNumber: 1
};

const TEST_INTENTION = {
	goalId: 1,
	orderNumber: 1,
	completed: 0,
	text: 'Test intention',
	subIntentionQualifier: null,
	date: new Date().toISOString()
};

describe('outcomes', () => {
	let db: Kysely<DB>;
	const createCaller = createCallerFactory(router);
	const caller = createCaller({});

	beforeEach(async () => {
		const dbInstance = DbInstance.getInstance();
		dbInstance.setNewTestDb();
		db = dbInstance.db;
		await migrateToLatest(db);

		await db.insertInto('goals').values(TEST_GOAL).execute();
		await db.insertInto('intentions').values(TEST_INTENTION).execute();
	});

	afterEach(async () => {
		await db.destroy();
		DbInstance.resetInstance();
	});

	it('list returns an empty array when there are no outcomes', async () => {
		const result = (await caller.outcomes.list()) as Outcome[];
		expect(result).toEqual([]);
	});

	it('create inserts an outcome and its intention pairs', async () => {
		const date = new Date().toISOString().split('T')[0];
		const result = (await caller.outcomes.create({
			outcome: { reviewed: 0, date },
			outcomesIntentions: [{ intentionId: 1 }]
		})) as { outcomeId: number };
		expect(result.outcomeId).toBeGreaterThan(0);

		const outcomes = (await caller.outcomes.list()) as Outcome[];
		expect(outcomes.length).toBe(1);
		expect(outcomes[0].date).toBe(date);
		expect(outcomes[0].reviewed).toBe(0);

		const pairs = (await caller.outcomes.listOutcomesIntentions(result.outcomeId)) as {
			outcomeId: number;
			intentionId: number;
		}[];
		expect(pairs).toEqual([{ outcomeId: result.outcomeId, intentionId: 1 }]);
	});

	it('create on an existing date updates reviewed instead of inserting', async () => {
		const date = new Date().toISOString().split('T')[0];
		await caller.outcomes.create({
			outcome: { reviewed: 0, date },
			outcomesIntentions: []
		});
		const result = (await caller.outcomes.create({
			outcome: { reviewed: 1, date },
			outcomesIntentions: [{ intentionId: 1 }]
		})) as { outcomeId: number };

		const outcomes = (await caller.outcomes.list()) as Outcome[];
		expect(outcomes.length).toBe(1);
		expect(outcomes[0].reviewed).toBe(1);
		expect(outcomes[0].id).toBe(result.outcomeId);
	});

	it('createOrUpdateOutcome inserts associations for a new outcome', async () => {
		const date = new Date().toISOString().split('T')[0];
		const result = (await caller.outcomes.createOrUpdateOutcome({
			outcome: { reviewed: 1, date },
			intentionIds: [1]
		})) as { outcomeId: number };

		const pairs = (await caller.outcomes.listOutcomesIntentions(result.outcomeId)) as {
			intentionId: number;
		}[];
		expect(pairs.map((pair) => pair.intentionId)).toEqual([1]);
	});

	it('list filters by date range', async () => {
		await db.insertInto('outcomes').values({ reviewed: 0, date: '2026-01-01' }).execute();
		await db.insertInto('outcomes').values({ reviewed: 0, date: '2026-02-01' }).execute();
		await db.insertInto('outcomes').values({ reviewed: 0, date: '2026-03-01' }).execute();

		const result = (await caller.outcomes.list({
			startDate: new Date('2026-01-15T00:00:00Z'),
			endDate: new Date('2026-02-15T00:00:00Z')
		})) as Outcome[];
		expect(result.length).toBe(1);
		expect(result[0].date).toBe('2026-02-01');
	});
});
