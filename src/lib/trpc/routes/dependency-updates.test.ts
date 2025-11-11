import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, router } from '../router';
import { GoalSchema } from './goals';
import { IntentionsSchema } from './intentions';
import { OutcomeSchema } from './outcomes';

/**
 * Integration tests for dependency updates PR
 * Tests critical cross-stack functionality that could break with major version updates
 */

describe('Dependency Integration Tests', () => {
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

	it('complex multi-table transaction with tRPC caller', async () => {
		const result = await caller.goals.add({ active: 1, title: 'Test Goal', description: 'Test', color: '#000000' });
		const goalId = Number(result.id);
		const logs = await db.selectFrom('goal_logs').where('goalId', '=', goalId).selectAll().execute();
		expect(logs).toHaveLength(1);
		expect(logs[0].type).toBe('start');
	});

	it('SQL JOIN queries with aggregation work correctly', async () => {
		await caller.goals.add({ active: 1, title: 'G1', description: '', color: '#000' });
		await new Promise(resolve => setTimeout(resolve, 100));
		await caller.goals.add({ active: 1, title: 'G2', description: '', color: '#111' });
		const sorted = await caller.goals.listGoalsSortedByDate(1);
		expect(sorted).toHaveLength(2);
		expect(sorted[0].title).toBe('G2');
	});

	it('complex SQL with subqueries and NOT EXISTS', async () => {
		const goal = await caller.goals.add({ active: 1, title: 'Test', description: '', color: '#000' });
		const goalsOnDate = await caller.goals.listGoalsOnDate({ active: 1, date: new Date() });
		expect(goalsOnDate.some(g => g.id === goal.id)).toBe(true);
	});

	it('cascading deletes across multiple related tables', async () => {
		const goal = await caller.goals.add({ active: 1, title: 'Test', description: '', color: '#000' });
		await db.insertInto('goals').values({ id: 99, active: 1, title: 'Ref', description: '', color: '#000', orderNumber: 2 }).execute();
		await db.insertInto('intentions').values({ goalId: Number(goal.id), orderNumber: 1, completed: 0, text: 'test', date: new Date().toISOString() }).execute();
		await caller.goals.delete(Number(goal.id));
		expect(await db.selectFrom('intentions').where('goalId', '=', Number(goal.id)).selectAll().execute()).toHaveLength(0);
		expect(await db.selectFrom('goal_logs').where('goalId', '=', Number(goal.id)).selectAll().execute()).toHaveLength(0);
	});

	it('SQL string concatenation operations', async () => {
		await db.insertInto('goals').values({ id: 1, active: 1, title: 'Test', description: '', color: '#000', orderNumber: 1 }).execute();
		const intention = await db.insertInto('intentions').values({ goalId: 1, orderNumber: 1, completed: 0, text: 'initial', date: new Date().toISOString() }).returning('id').executeTakeFirstOrThrow();
		await caller.intentions.appendText({ id: intention.id, text: ' appended' });
		const updated = await db.selectFrom('intentions').where('id', '=', intention.id).selectAll().executeTakeFirstOrThrow();
		expect(updated.text).toBe('initial appended');
	});

	it('Zod schema validation with actual app schemas', () => {
		expect(() => GoalSchema.parse({ id: 1, active: 1, orderNumber: 1, title: 'Test', description: null, color: '#000' })).not.toThrow();
		expect(() => IntentionsSchema.parse({ id: 1, goalId: 1, orderNumber: 1, completed: 0, text: 'test', subIntentionQualifier: null, date: '2024-01-01T00:00:00.000Z' })).not.toThrow();
		expect(() => OutcomeSchema.parse({ id: null, reviewed: 0, date: '2024-01-01' })).not.toThrow();
	});

	it('Zod validation rejects invalid data in app schemas', () => {
		expect(() => GoalSchema.parse({ active: 1, title: 'Missing fields' })).toThrow();
		expect(() => OutcomeSchema.parse({ reviewed: 0, date: '2024-01-01T00:00:00' })).toThrow();
	});

	it('raw SQL template literals with Kysely', async () => {
		await db.insertInto('goals').values({ active: 1, title: 'Test', description: '', color: '#000', orderNumber: 1 }).execute();
		const result = await sql<{ count: number }>`SELECT COUNT(*) as count FROM goals WHERE active = 1`.execute(db);
		expect(result.rows[0].count).toBe(1);
	});

	it('transaction rollback on error', async () => {
		await expect(async () => {
			await db.transaction().execute(async (trx) => {
				await trx.insertInto('goals').values({ active: 1, title: 'Test', description: '', color: '#000', orderNumber: 1 }).execute();
				throw new Error('Force rollback');
			});
		}).rejects.toThrow('Force rollback');
		expect(await db.selectFrom('goals').selectAll().execute()).toHaveLength(0);
	});

	it('tRPC error propagation from database layer', async () => {
		await expect(caller.goals.delete(99999)).rejects.toThrow();
	});
});
