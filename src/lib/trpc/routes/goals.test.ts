/* eslint-disable @typescript-eslint/no-explicit-any */
import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely, UpdateResult } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Goal } from '../types';
import { goals } from './goals';

type GoalInput = Omit<Goal, 'id' | 'orderNumber'>;

const TEST_GOAL: GoalInput = {
	active: 1,
	title: 'Test Goal 1',
	description: 'A goal for testing purposes.',
	color: 'hsl(0, 0%, 50%)'
};

describe('goals', () => {
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

	it('list goals for both active and inactive', async () => {
		const activeStates = [1, 0];
		// Loop through both active states
		for (const activeState of activeStates) {
			const added1 = await goals.add({
				rawInput: TEST_GOAL,
				path: 'add',
				type: 'mutation',
				ctx: {}
			});
			const id1 = Number((added1 as any)[0]?.insertId);
			// Archive the goal to make it inactive
			if (activeState === 0) {
				await goals.archive({ rawInput: id1, path: 'archive', type: 'mutation', ctx: {} });
			}

			const result = (await goals.list({
				rawInput: activeState,
				path: 'list',
				type: 'query',
				ctx: {}
			})) as Goal[];

			expect(result).toBeInstanceOf(Array);
			expect(result.every((goal) => goal.active === activeState)).toBe(true);
			expect(result).toHaveLength(1);

			// Adjust the expectation for inactive goals
			const expectedGoal = { ...TEST_GOAL, active: activeState };

			expect(result[0]).toEqual(expect.objectContaining(expectedGoal));
		}
	});

	it('list goals when no goals are present', async () => {
		const result = (await goals.list({
			rawInput: 1,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Goal[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(0);
	});

	it('listGoalsSortedByDate', async () => {
		const added1 = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });

		// Add a small delay to ensure a distinct timestamp
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const added2 = await goals.add({
			rawInput: { ...TEST_GOAL, title: 'Test Goal 2' },
			path: 'add',
			type: 'mutation',
			ctx: {}
		});

		const result = (await goals.listGoalsSortedByDate({
			rawInput: 1,
			path: 'listGoalsSortedByDate',
			type: 'query',
			ctx: {}
		})) as Goal[];
		expect(result).toBeInstanceOf(Array);

		const goal1 = result.find((goal) => goal.id === Number((added1 as any)[0]?.insertId));
		const goal2 = result.find((goal) => goal.id === Number((added2 as any)[0]?.insertId));
		expect(goal1).toBeDefined();
		expect(goal2).toBeDefined();
		if (goal1 && goal2) {
			const goal1Logs = await db
				.selectFrom('goal_logs')
				.selectAll()
				.where('goalId', '=', goal1.id)
				.execute();
			const goal2Logs = await db
				.selectFrom('goal_logs')
				.selectAll()
				.where('goalId', '=', goal2.id)
				.execute();
			expect(goal1Logs).toHaveLength(1);
			expect(goal2Logs).toHaveLength(1);
			// compare date values
			expect(new Date(goal1Logs[0].date).getTime()).toBeLessThan(
				new Date(goal2Logs[0].date).getTime()
			);

			// Ensure they are in the right order in the array (most recent first)
			const goal1Index = result.findIndex((goal) => goal.id === goal1.id);
			const goal2Index = result.findIndex((goal) => goal.id === goal2.id);
			expect(goal2Index).toBeLessThan(goal1Index);
		}
	});

	it('listGoalsOnDate for both active and inactive goals', async () => {
		// Add an active goal
		const addedGoal1 = await goals.add({
			rawInput: TEST_GOAL,
			path: 'add',
			type: 'mutation',
			ctx: {}
		});

		// Archive the goal to make it inactive
		const id1 = Number((addedGoal1 as any)[0]?.insertId);
		await goals.archive({ rawInput: id1, path: 'archive', type: 'mutation', ctx: {} });

		// Get today's date
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Retrieve active goals for the current date
		const activeGoals = (await goals.listGoalsOnDate({
			rawInput: { active: 1, date: today },
			path: 'listGoalsOnDate',
			type: 'query',
			ctx: {}
		})) as Goal[];

		// Retrieve inactive goals for the current date
		const inactiveGoals = (await goals.listGoalsOnDate({
			rawInput: { active: 0, date: today },
			path: 'listGoalsOnDate',
			type: 'query',
			ctx: {}
		})) as Goal[];

		// Check if both active and inactive goals have the correct length
		expect(activeGoals).toHaveLength(0);
		expect(inactiveGoals).toHaveLength(1);

		// Check that the goals have the expected properties
		const expectedInactiveGoal = { ...TEST_GOAL, active: 0, orderNumber: 0 };
		expect(inactiveGoals[0]).toEqual(expect.objectContaining(expectedInactiveGoal));
	});

	it('add', async () => {
		const result = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		expect(result).toBeInstanceOf(Array);
		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual(expect.objectContaining(TEST_GOAL));
	});

	it('add with missing fields', async () => {
		const input = { active: 1, title: '' }; // Missing 'color' field
		let error;
		try {
			await goals.add({ rawInput: input, path: 'add', type: 'mutation', ctx: {} });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('add creates a log entry', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		const logEntries = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id)
			.execute();

		expect(logEntries).toHaveLength(1);
		expect(logEntries[0].type).toEqual('start');
	});

	it('edit', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		const goalToEdit = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirst();
		const editedGoal = { ...goalToEdit, title: 'Modified Test Goal' };

		const result = (await goals.edit({
			rawInput: editedGoal,
			path: 'edit',
			type: 'mutation',
			ctx: {}
		})) as UpdateResult;
		expect(Number(result.numUpdatedRows)).toEqual(1);

		const editedGoalFromDb = await db
			.selectFrom('goals')
			.select('title')
			.where('id', '=', id)
			.executeTakeFirst();
		expect(editedGoalFromDb).toBeDefined();
		if (editedGoalFromDb) {
			expect(editedGoalFromDb.title).toEqual('Modified Test Goal');
		}
	});

	it('edit a non-existent goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await goals.edit({ rawInput: { ...TEST_GOAL, id }, path: 'edit', type: 'mutation', ctx: {} });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('updateGoals with multiple goals', async () => {
		// Add multiple goals
		const added1 = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id1 = Number((added1 as any)[0]?.insertId);

		const added2 = await goals.add({
			rawInput: { ...TEST_GOAL, title: 'Test Goal 2' },
			path: 'add',
			type: 'mutation',
			ctx: {}
		});
		const id2 = Number((added2 as any)[0]?.insertId);

		const added3 = await goals.add({
			rawInput: { ...TEST_GOAL, title: 'Test Goal 3' },
			path: 'add',
			type: 'mutation',
			ctx: {}
		});
		const id3 = Number((added3 as any)[0]?.insertId);

		// Prepare the goals to be updated
		const goalToEdit1 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id1)
			.executeTakeFirst();
		const editedGoal1 = { ...goalToEdit1, title: 'Modified Test Goal 1' };

		const goalToEdit2 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id2)
			.executeTakeFirst();
		const editedGoal2 = { ...goalToEdit2, title: 'Modified Test Goal 2' };

		const goalToEdit3 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id3)
			.executeTakeFirst();
		const editedGoal3 = { ...goalToEdit3, title: 'Modified Test Goal 3' };

		// Call updateGoals with the updated goals
		const result = await goals.updateGoals({
			rawInput: { goals: [editedGoal1, editedGoal2, editedGoal3] },
			path: 'updateGoals',
			type: 'mutation',
			ctx: {}
		});

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(3);

		// Check that the goals have been updated correctly
		const updatedGoal1 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id1)
			.executeTakeFirst();
		expect(updatedGoal1?.title).toEqual('Modified Test Goal 1');

		const updatedGoal2 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id2)
			.executeTakeFirst();
		expect(updatedGoal2?.title).toEqual('Modified Test Goal 2');

		const updatedGoal3 = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', id3)
			.executeTakeFirst();
		expect(updatedGoal3?.title).toEqual('Modified Test Goal 3');
	});

	it('delete', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		await goals.delete({ rawInput: id, path: 'delete', type: 'mutation', ctx: {} });
		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows).toHaveLength(0);
	});

	it('delete non-existing goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await goals.delete({ rawInput: id, path: 'delete', type: 'mutation', ctx: {} });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('delete removes all log entries for a goal', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		await goals.delete({ rawInput: id, path: 'delete', type: 'mutation', ctx: {} });

		const logEntries = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id)
			.execute();

		expect(logEntries).toHaveLength(0);
	});

	it('archive', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		await goals.archive({ rawInput: id, path: 'archive', type: 'mutation', ctx: {} });

		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows[0].active).toEqual(0);
	});

	it('archive a non-existent goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await goals.archive({ rawInput: id, path: 'archive', type: 'mutation', ctx: {} });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('restore', async () => {
		const added = await goals.add({ rawInput: TEST_GOAL, path: 'add', type: 'mutation', ctx: {} });
		const id = Number((added as any)[0]?.insertId);

		await goals.archive({ rawInput: id, path: 'archive', type: 'mutation', ctx: {} });
		await goals.restore({ rawInput: id, path: 'restore', type: 'mutation', ctx: {} });

		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows[0].active).toEqual(1);
	});

	it('restore a non-existent goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await goals.restore({ rawInput: id, path: 'restore', type: 'mutation', ctx: {} });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});
});
