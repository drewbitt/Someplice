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

	it('saveReview inserts new intentions, applies completions, and links everything', async () => {
		const date = new Date().toISOString().split('T')[0];
		const result = (await caller.outcomes.saveReview({
			outcome: { reviewed: 1, date },
			newIntentions: [{ ...TEST_INTENTION, orderNumber: 2, text: 'new outcome text' }],
			completions: [{ intentionId: 1, completed: 1 }]
		})) as { outcomeId: number };

		const intentions = await db.selectFrom('intentions').selectAll().orderBy('id', 'asc').execute();
		expect(intentions.length).toBe(2);
		expect(intentions[0].completed).toBe(1);
		expect(intentions[1].text).toBe('new outcome text');

		const pairs = await db
			.selectFrom('outcomes_intentions')
			.selectAll()
			.where('outcomeId', '=', result.outcomeId)
			.execute();
		expect(pairs.map((pair) => pair.intentionId).sort()).toEqual([1, 2]);
	});

	it('saveReview on an existing date updates reviewed without duplicating pairs', async () => {
		const date = new Date().toISOString().split('T')[0];
		await caller.outcomes.saveReview({
			outcome: { reviewed: 0, date },
			newIntentions: [],
			completions: [{ intentionId: 1, completed: 0 }]
		});
		const result = (await caller.outcomes.saveReview({
			outcome: { reviewed: 1, date },
			newIntentions: [],
			completions: [{ intentionId: 1, completed: 1 }]
		})) as { outcomeId: number };

		const outcomes = (await caller.outcomes.list()) as Outcome[];
		expect(outcomes.length).toBe(1);
		expect(outcomes[0].reviewed).toBe(1);
		expect(outcomes[0].id).toBe(result.outcomeId);

		const pairs = await db
			.selectFrom('outcomes_intentions')
			.selectAll()
			.where('outcomeId', '=', result.outcomeId)
			.execute();
		expect(pairs.length).toBe(1);
	});

	it('saveReview rolls back everything when a step fails, so a retry is clean', async () => {
		const date = new Date().toISOString().split('T')[0];

		let error;
		try {
			await caller.outcomes.saveReview({
				outcome: { reviewed: 1, date },
				newIntentions: [{ ...TEST_INTENTION, orderNumber: 2, text: 'new outcome text' }],
				completions: [{ intentionId: 9999, completed: 1 }] // does not exist
			});
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();

		// Nothing persisted — the new intention rolled back with the failed completion
		const intentions = await db.selectFrom('intentions').selectAll().execute();
		expect(intentions.length).toBe(1);
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(0);

		// And a retry with a valid completion succeeds, including the new insert
		await caller.outcomes.saveReview({
			outcome: { reviewed: 1, date },
			newIntentions: [{ ...TEST_INTENTION, orderNumber: 2, text: 'new outcome text' }],
			completions: [{ intentionId: 1, completed: 1 }]
		});
		expect(await db.selectFrom('intentions').selectAll().execute()).toHaveLength(2);
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(1);
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
