import { createDb, getDb, setDb } from '$src/lib/db/db';
import { runMigrations } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Goal } from '../types';
import { createCallerFactory, router } from '../router';

interface GoalResult {
	id: number | null;
}
type GoalInput = Omit<Goal, 'id' | 'orderNumber'>;

const TEST_GOAL: GoalInput = {
	active: 1, // Active
	title: 'Test Goal 1',
	description: 'A goal for testing purposes.',
	color: 'hsl(0, 0%, 50%)'
};

describe('goals', () => {
	let db: Kysely<DB>;
	const createCaller = createCallerFactory(router);
	const caller = createCaller({});

	beforeEach(async () => {
		setDb(createDb(':memory:'));
		db = getDb();
		await runMigrations(db);
	});

	afterEach(async () => {
		await db.destroy();
	});

	it('list goals for both active and inactive', async () => {
		const activeStates = [1, 0];
		// Loop through both active states
		for (const activeState of activeStates) {
			const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
			const id1 = Number(added.id);
			// Archive the goal to make it inactive
			if (activeState === 0) {
				await caller.goals.archive(id1);
			}

			const result = (await caller.goals.list(activeState)) as Goal[];

			expect(result).toBeInstanceOf(Array);
			expect(result.every((goal) => goal.active === activeState)).toBe(true);
			expect(result).toHaveLength(1);

			// Adjust the expectation for inactive goals
			const expectedGoal = { ...TEST_GOAL, active: activeState };

			expect(result[0]).toEqual(expect.objectContaining(expectedGoal));
		}
	});

	it('list goals when no goals are present', async () => {
		const result = (await caller.goals.list(1)) as Goal[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(0);
	});

	it('listGoalsSortedByDate', async () => {
		const added1 = (await caller.goals.add(TEST_GOAL)) as GoalResult;

		// Add a small delay to ensure a distinct timestamp
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const added2 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;

		const result = (await caller.goals.listGoalsSortedByDate(1)) as Goal[];
		expect(result).toBeInstanceOf(Array);

		const goal1 = result.find((goal) => goal.id === Number(added1.id));
		const goal2 = result.find((goal) => goal.id === Number(added2.id));
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

	// TODO: improve test
	it('listGoalsOnDate for both active and inactive goals', async () => {
		// Add an active goal
		(await caller.goals.add(TEST_GOAL)) as GoalResult;

		// Get today's date
		const today = new Date();

		// Retrieve active goals for the current date
		const activeGoals = (await caller.goals.listGoalsOnDate({ active: 1, date: today })) as Goal[];

		// Retrieve inactive goals for the current date
		const inactiveGoals = (await caller.goals.listGoalsOnDate({
			active: 0,
			date: today
		})) as Goal[];

		// Check if both active and inactive goals have the correct length
		expect(activeGoals).toHaveLength(1);
		expect(inactiveGoals).toHaveLength(0);

		// Check that the goals have the expected properties
		expect(activeGoals[0]).toEqual(expect.objectContaining(TEST_GOAL));
	});

	it('add', async () => {
		const result = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		expect(result.id).toBeDefined();
		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual(expect.objectContaining(TEST_GOAL));
	});

	it('add with missing fields', async () => {
		const input = { active: 1, title: '' }; // Missing 'color' field
		let error;
		try {
			(await caller.goals.add(input as GoalInput)) as GoalResult;
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('add creates a log entry', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		const logEntries = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id)
			.execute();

		expect(logEntries).toHaveLength(1);
		expect(logEntries[0].type).toEqual('start');
	});

	it('updateGoals with multiple goals', async () => {
		// Add multiple goals
		const added1 = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id1 = Number(added1.id);

		const added2 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;
		const id2 = Number(added2.id);

		const added3 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 3' })) as GoalResult;
		const id3 = Number(added3.id);

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
		const result = await caller.goals.updateGoals({
			goals: [editedGoal1, editedGoal2, editedGoal3] as Goal[]
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
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.delete(id);
		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows).toHaveLength(0);
	});

	it('delete non-existing goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await caller.goals.delete(id);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('delete removes all log entries for a goal', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.delete(id);

		const logEntries = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id)
			.execute();

		expect(logEntries).toHaveLength(0);
	});

	it('archive', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.archive(id);

		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows[0].active).toEqual(0);
	});

	it('archive a non-existent goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await caller.goals.archive(id);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('restore', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.archive(id);
		await caller.goals.restore(id);

		const rows = await db.selectFrom('goals').selectAll().execute();
		expect(rows[0].active).toEqual(1);
	});

	it('restore logs the restored orderNumber', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.archive(id);
		await caller.goals.restore(id);

		const logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id)
			.orderBy('id', 'asc')
			.execute();

		expect(logs).toHaveLength(3);
		expect(logs[2].type).toEqual('start');
		expect(logs[2].orderNumber).toEqual(1);
	});

	it('archive an already archived goal errors', async () => {
		const added = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const id = Number(added.id);

		await caller.goals.archive(id);

		let error;
		try {
			await caller.goals.archive(id);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('updateGoals reordering writes reorder logs and does not trip the unique index', async () => {
		const added1 = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const added2 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;
		const added3 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 3' })) as GoalResult;
		const id1 = Number(added1.id);
		const id2 = Number(added2.id);
		const id3 = Number(added3.id);

		const rows = await db.selectFrom('goals').selectAll().orderBy('id', 'asc').execute();
		// Swap positions 1 and 3: a permutation that only succeeds via the two-phase update
		const reordered = rows.map((row) => ({
			...row,
			orderNumber: row.orderNumber === 1 ? 3 : row.orderNumber === 3 ? 1 : 2
		}));
		await caller.goals.updateGoals({ goals: reordered as Goal[] });

		const updated = await db
			.selectFrom('goals')
			.selectAll()
			.orderBy('orderNumber', 'asc')
			.execute();
		expect(updated[0].id).toEqual(id3);
		expect(updated[2].id).toEqual(id1);

		const goal1Logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id1)
			.execute();
		const goal2Logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id2)
			.execute();
		const goal3Logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id3)
			.execute();

		expect(goal1Logs.map((l) => l.type)).toEqual(['start', 'reorder']);
		expect(goal1Logs[1].orderNumber).toEqual(3);
		// goal2 did not move, so no reorder log
		expect(goal2Logs.map((l) => l.type)).toEqual(['start']);
		expect(goal3Logs.map((l) => l.type)).toEqual(['start', 'reorder']);
		expect(goal3Logs[1].orderNumber).toEqual(1);
	});

	it('updateGoals rejects duplicate orderNumbers for active goals', async () => {
		(await caller.goals.add(TEST_GOAL)) as GoalResult;
		(await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;

		const rows = await db.selectFrom('goals').selectAll().orderBy('id', 'asc').execute();
		const duplicated = rows.map((row) => ({ ...row, orderNumber: 1 }));

		let error;
		try {
			await caller.goals.updateGoals({ goals: duplicated as Goal[] });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();

		// And nothing was persisted
		const after = await db.selectFrom('goals').selectAll().orderBy('id', 'asc').execute();
		expect(after[0].orderNumber).toEqual(1);
		expect(after[1].orderNumber).toEqual(2);
	});

	it('listGoalsOnDate reflects reorder logs on a later date', async () => {
		const added1 = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const added2 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;
		const id1 = Number(added1.id);
		const id2 = Number(added2.id);

		// Reorder: goal2 moves to the front
		const rows = await db.selectFrom('goals').selectAll().orderBy('id', 'asc').execute();
		const reordered = rows.map((row) => ({
			...row,
			orderNumber: row.orderNumber === 1 ? 2 : 1
		}));
		await caller.goals.updateGoals({ goals: reordered as Goal[] });

		const goalsOnDate = (await caller.goals.listGoalsOnDate({
			active: 1,
			date: new Date()
		})) as Goal[];
		expect(goalsOnDate.map((g) => g.id)).toEqual([id2, id1]);
	});

	it('delete compacts active orderNumbers and logs the shifts', async () => {
		const ids: number[] = [];
		for (let i = 1; i <= 9; i++) {
			const added = (await caller.goals.add({
				...TEST_GOAL,
				title: `Test Goal ${i}`
			})) as GoalResult;
			ids.push(Number(added.id));
		}

		// delete the 4th goal
		await caller.goals.delete(ids[3]);

		const remaining = await db
			.selectFrom('goals')
			.selectAll()
			.orderBy('orderNumber', 'asc')
			.execute();
		expect(remaining).toHaveLength(8);
		expect(remaining.map((g) => g.orderNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

		// each goal that shifted down gets a 'reorder' log with its new orderNumber
		for (const [index, id] of ids.slice(4).entries()) {
			const logs = await db
				.selectFrom('goal_logs')
				.selectAll()
				.where('goalId', '=', id)
				.orderBy('id', 'asc')
				.execute();
			expect(logs.map((l) => `${l.type}:${l.orderNumber}`)).toEqual([
				`start:${index + 5}`,
				`reorder:${index + 4}`
			]);
		}

		// a new goal takes the freed slot at the end
		const added = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 10' })) as GoalResult;
		const newGoal = await db
			.selectFrom('goals')
			.selectAll()
			.where('id', '=', Number(added.id))
			.executeTakeFirstOrThrow();
		expect(newGoal.orderNumber).toEqual(9);
	});

	it('add throws BAD_REQUEST when the goal cap is reached', async () => {
		for (let i = 1; i <= 9; i++) {
			(await caller.goals.add({ ...TEST_GOAL, title: `Test Goal ${i}` })) as GoalResult;
		}

		let error;
		try {
			await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 10' });
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
		expect((error as { code?: string }).code).toEqual('BAD_REQUEST');
	});

	it('archive logs reorder entries for goals shifted into the gap', async () => {
		const added1 = (await caller.goals.add(TEST_GOAL)) as GoalResult;
		const added2 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 2' })) as GoalResult;
		const added3 = (await caller.goals.add({ ...TEST_GOAL, title: 'Test Goal 3' })) as GoalResult;
		const id1 = Number(added1.id);
		const id2 = Number(added2.id);
		const id3 = Number(added3.id);

		await caller.goals.archive(id1);

		const goal2Logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id2)
			.execute();
		const goal3Logs = await db
			.selectFrom('goal_logs')
			.selectAll()
			.where('goalId', '=', id3)
			.execute();
		expect(goal2Logs.map((l) => `${l.type}:${l.orderNumber}`)).toEqual(['start:2', 'reorder:1']);
		expect(goal3Logs.map((l) => `${l.type}:${l.orderNumber}`)).toEqual(['start:3', 'reorder:2']);

		// A review after the archive sees the shifted positions, not the pre-archive ones
		const goalsOnDate = (await caller.goals.listGoalsOnDate({
			active: 1,
			date: new Date()
		})) as Goal[];
		expect(goalsOnDate.map((g) => g.id)).toEqual([id2, id3]);
	});

	it('restore a non-existent goal', async () => {
		const id = 99999; // Non-existing ID
		let error;
		try {
			await caller.goals.restore(id);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});
});
