import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GoalLog } from '../types';
import { createCallerFactory, router } from '../router';

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
