import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GoalLog } from '../types';
import { goal_logs } from './goal_logs';
import { goals } from './goals';

const TEST_GOAL_LOG: GoalLog = {
	id: 1,
	goalId: 1,
	type: 'start',
	date: new Date().toISOString(),
	orderNumber: 1
};

describe('goal_logs', () => {
	let db: Kysely<DB>;

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
			const added = await goal_logs.create({
				rawInput: TEST_GOAL_LOG,
				path: 'create',
				type: 'mutation',
				ctx: {}
			});
			expect(added).toBeDefined();
		} catch (e) {
			error = e;
		}
		expect(error).toBeUndefined();

		// Lookup the goal log
		const result = (await goal_logs.getAllForGoal({
			rawInput: 1,
			path: 'getAllForGoal',
			type: 'query',
			ctx: {}
		})) as GoalLog[];
		expect(result).toBeDefined();
		expect(result.length).toBe(1);
		expect(result[0].type).toBe(TEST_GOAL_LOG.type);
		expect(result[0].date).toBe(TEST_GOAL_LOG.date);
	});

	it('create with invalid goalId', async () => {
		const INVALID_TEST_GOAL_LOG = { ...TEST_GOAL_LOG, goalId: 999 }; // invalid goalId
		let error;
		try {
			const added = await goal_logs.create({
				rawInput: INVALID_TEST_GOAL_LOG,
				path: 'create',
				type: 'mutation',
				ctx: {}
			});
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
		await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });

		// Check that the goal is started
		const allResults = (await goal_logs.getAll({
			rawInput: undefined,
			path: 'getAll',
			type: 'query',
			ctx: {}
		})) as GoalLog[];
		expect(allResults).toBeDefined();
		expect(allResults.length).toBe(1);
		expect(allResults[0].type).toBe('start');
		expect(allResults[0].date).toBeDefined();
		expect(allResults[0].goalId).toBeDefined();

		// Check that the goal is started by checking id
		const singleResult = (await goal_logs.getAllForGoal({
			rawInput: allResults[0].goalId,
			path: 'getAllForGoal',
			type: 'query',
			ctx: {}
		})) as GoalLog[];
		expect(singleResult).toBeDefined();
		expect(singleResult.length).toBe(1);
		expect(singleResult[0].type).toBe('start');
		expect(singleResult[0].date).toBeDefined();
		expect(singleResult[0].goalId).toBeDefined();
		expect(singleResult[0].goalId).toBe(allResults[0].goalId);
	});
});
