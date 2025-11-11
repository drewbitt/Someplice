import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GoalLog } from '../types';
import { createCallerFactory, router } from '../router';

const TEST_GOAL_LOG: GoalLog = {
	id: 1,
	goalId: 1,
	type: 'start',
	date: new Date().toISOString(),
	orderNumber: 1
};

describe('goal_logs', () => {
	let db: Kysely<DB>;
	const createCaller = createCallerFactory(router);
	const caller = createCaller({});

	beforeEach(async () => {
		const dbInstance = DbInstance.getInstance();
		dbInstance.setNewTestDb();
		db = dbInstance.db;
		await migrateToLatest(db);
	});

	afterEach(async () => {
		await db.destroy();
		DbInstance.resetInstance();
	});

	it('create', async () => {
		// Insert a test goal
		const TEST_GOAL = {
			active: 1,
			title: 'Test Goal',
			description: 'A goal for testing purposes.',
			color: 'hsl(0, 0%, 50%)',
			orderNumber: 1
		};

		await db.insertInto('goals').values(TEST_GOAL).execute();

		let error;
		try {
			const added = await caller.goal_logs.create(TEST_GOAL_LOG);
			expect(added).toBeDefined();
		} catch (e) {
			error = e;
		}
		expect(error).toBeUndefined();

		// Lookup the goal log
		const result = (await caller.goal_logs.getAllForGoal(1)) as GoalLog[];
		expect(result).toBeDefined();
		expect(result.length).toBe(1);
		expect(result[0].type).toBe(TEST_GOAL_LOG.type);
		expect(result[0].date).toBe(TEST_GOAL_LOG.date);
	});

	it('create with invalid goalId', async () => {
		const INVALID_TEST_GOAL_LOG = { ...TEST_GOAL_LOG, goalId: 999 }; // invalid goalId
		let error;
		try {
			const added = await caller.goal_logs.create(INVALID_TEST_GOAL_LOG);
			expect(added).toBeDefined();
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('ensure adding a goal with TRPC starts it', async () => {
		// Add a test goal
		const TEST_GOAL = {
			active: 1,
			title: 'Test Goal',
			description: 'A goal for testing purposes.',
			color: 'hsl(0, 0%, 50%)'
		};
		await caller.goals.add(TEST_GOAL);

		// Check that the goal is started
		const allResults = (await caller.goal_logs.getAll(undefined)) as GoalLog[];
		expect(allResults).toBeDefined();
		expect(allResults.length).toBe(1);
		expect(allResults[0].type).toBe('start');
		expect(allResults[0].date).toBeDefined();
		expect(allResults[0].goalId).toBeDefined();

		// Check that the goal is started by checking id
		const singleResult = (await caller.goal_logs.getAllForGoal(allResults[0].goalId)) as GoalLog[];
		expect(singleResult).toBeDefined();
		expect(singleResult.length).toBe(1);
		expect(singleResult[0].type).toBe('start');
		expect(singleResult[0].date).toBeDefined();
		expect(singleResult[0].goalId).toBeDefined();
		expect(singleResult[0].goalId).toBe(allResults[0].goalId);
	});
});
