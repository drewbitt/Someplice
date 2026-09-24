import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Goal, PriorityWithGoal } from '../types';
import { createCallerFactory, router } from '../router';

interface GoalResult {
	id: number | null;
}
type GoalInput = Omit<Goal, 'id' | 'orderNumber'>;

const TEST_GOAL: GoalInput = {
	active: 1,
	title: 'Test Goal 1',
	description: 'A goal for testing purposes.',
	color: 'hsl(0, 0%, 50%)'
};

describe('priorities', () => {
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

	const addGoal = async (input: GoalInput = TEST_GOAL) => {
		const added = (await caller.goals.add(input)) as GoalResult;
		return Number(added.id);
	};

	it('upsert creates an active priority joined with goal fields', async () => {
		const goalId = await addGoal();

		await caller.priorities.upsert({
			goalId,
			text: 'Ship the feature',
			description: 'A description',
			checkInDate: '2026-10-01'
		});

		const result = (await caller.priorities.list()) as PriorityWithGoal[];
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({
				goalId,
				text: 'Ship the feature',
				description: 'A description',
				checkInDate: '2026-10-01',
				completedAt: null,
				goalTitle: TEST_GOAL.title,
				goalColor: TEST_GOAL.color,
				goalOrderNumber: 1
			})
		);
	});

	it('at most one active priority per goal: upsert completes the existing one', async () => {
		const goalId = await addGoal();

		await caller.priorities.upsert({ goalId, text: 'First priority' });
		await caller.priorities.upsert({ goalId, text: 'Second priority' });

		const active = (await caller.priorities.list()) as PriorityWithGoal[];
		expect(active).toHaveLength(1);
		expect(active[0].text).toBe('Second priority');

		const all = (await caller.priorities.list({ activeOnly: false })) as PriorityWithGoal[];
		expect(all).toHaveLength(2);
		const completed = (await caller.priorities.listCompleted()) as PriorityWithGoal[];
		expect(completed).toHaveLength(1);
		expect(completed[0].text).toBe('First priority');
		expect(completed[0].completedAt).not.toBeNull();
	});

	it('enforces one active priority per goal at the database level', async () => {
		const goalId = await addGoal();
		const now = new Date().toISOString();

		await db
			.insertInto('priorities')
			.values({
				goalId,
				text: 'Direct insert',
				createdAt: now,
				completedAt: null
			})
			.execute();

		await expect(
			db
				.insertInto('priorities')
				.values({
					goalId,
					text: 'Concurrent duplicate',
					createdAt: now,
					completedAt: null
				})
				.execute()
		).rejects.toThrow();
	});

	it('edit changes fields in place without completing the priority', async () => {
		const goalId = await addGoal();
		const { id } = await caller.priorities.upsert({ goalId, text: 'Original' });

		await caller.priorities.edit({
			id: Number(id),
			text: 'Edited',
			description: 'Added detail',
			checkInDate: '2026-11-15'
		});

		const active = (await caller.priorities.list()) as PriorityWithGoal[];
		expect(active).toHaveLength(1);
		expect(active[0]).toEqual(
			expect.objectContaining({
				text: 'Edited',
				description: 'Added detail',
				checkInDate: '2026-11-15',
				completedAt: null
			})
		);
		expect((await caller.priorities.listCompleted()) as PriorityWithGoal[]).toHaveLength(0);
	});

	it('edit clears nullable fields when passed null', async () => {
		const goalId = await addGoal();
		const { id } = await caller.priorities.upsert({
			goalId,
			text: 'Original',
			description: 'desc',
			checkInDate: '2026-11-15'
		});

		await caller.priorities.edit({ id: Number(id), description: null, checkInDate: null });

		const active = (await caller.priorities.list()) as PriorityWithGoal[];
		expect(active[0].description).toBeNull();
		expect(active[0].checkInDate).toBeNull();
	});

	it('complete marks the priority done with a reflection', async () => {
		const goalId = await addGoal();
		const { id } = await caller.priorities.upsert({ goalId, text: 'Finish proposal' });

		await caller.priorities.complete({ id: Number(id), reflection: 'went well' });

		expect((await caller.priorities.list()) as PriorityWithGoal[]).toHaveLength(0);
		const completed = (await caller.priorities.listCompleted()) as PriorityWithGoal[];
		expect(completed).toHaveLength(1);
		expect(completed[0].reflection).toBe('went well');
		expect(completed[0].completedAt).not.toBeNull();

		// completing again throws — it is no longer active
		await expect(caller.priorities.complete({ id: Number(id) })).rejects.toThrow();
	});

	it('clear deletes the active priority without recording a milestone', async () => {
		const goalId = await addGoal();
		await caller.priorities.upsert({ goalId, text: 'Temporary' });

		await caller.priorities.clear(goalId);

		expect((await caller.priorities.list()) as PriorityWithGoal[]).toHaveLength(0);
		expect(
			(await caller.priorities.list({ activeOnly: false })) as PriorityWithGoal[]
		).toHaveLength(0);
		expect((await caller.priorities.listCompleted()) as PriorityWithGoal[]).toHaveLength(0);
	});

	it('listCompleted filters by date range and goalId', async () => {
		const goalId = await addGoal();
		const otherGoalId = await addGoal({ ...TEST_GOAL, title: 'Test Goal 2' });

		const { id } = await caller.priorities.upsert({ goalId, text: 'Done today' });
		await caller.priorities.complete({ id: Number(id) });
		const { id: otherId } = await caller.priorities.upsert({
			goalId: otherGoalId,
			text: 'Other goal'
		});
		await caller.priorities.complete({ id: Number(otherId) });

		const today = new Date();
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
		const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

		const inRange = (await caller.priorities.listCompleted({
			startDate: yesterday,
			endDate: tomorrow
		})) as PriorityWithGoal[];
		expect(inRange).toHaveLength(2);

		const outOfRange = (await caller.priorities.listCompleted({
			startDate: tomorrow,
			endDate: tomorrow
		})) as PriorityWithGoal[];
		expect(outOfRange).toHaveLength(0);

		const onlyGoal = (await caller.priorities.listCompleted({ goalId })) as PriorityWithGoal[];
		expect(onlyGoal).toHaveLength(1);
		expect(onlyGoal[0].goalId).toBe(goalId);
	});

	it('priorities are deleted when their goal is deleted', async () => {
		const goalId = await addGoal();
		await caller.priorities.upsert({ goalId, text: 'Will cascade' });

		await caller.goals.delete(goalId);

		expect(
			(await caller.priorities.list({ activeOnly: false })) as PriorityWithGoal[]
		).toHaveLength(0);
	});
});
