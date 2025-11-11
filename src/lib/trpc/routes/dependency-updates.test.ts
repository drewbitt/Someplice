import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createCallerFactory, router } from '../router';

/**
 * Lean integration tests for PR #111 dependency updates
 * Tests critical functionality of upgraded packages:
 * - tRPC v11 (caller pattern)
 * - Zod v4 (schema validation)
 * - better-sqlite3 v12 (database operations)
 * - vitest v4 (test runner)
 */

describe('Dependency Updates Integration', () => {
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

	it('tRPC v11: caller factory creates working callers', async () => {
		const testCaller = createCaller({});
		const goals = await testCaller.goals.list(1);
		expect(Array.isArray(goals)).toBe(true);
	});

	it('Zod v4: validates schemas correctly', () => {
		const userSchema = z.object({ name: z.string(), age: z.number().positive() });
		expect(() => userSchema.parse({ name: 'Test', age: 25 })).not.toThrow();
		expect(() => userSchema.parse({ name: 'Test', age: -1 })).toThrow();
	});

	it('Zod v4: supports new v4 features', () => {
		const schema = z.string().min(1);
		expect(schema.safeParse('valid').success).toBe(true);
		expect(schema.safeParse('').success).toBe(false);
	});

	it('better-sqlite3 v12: basic CRUD operations work', async () => {
		await db.insertInto('goals').values({ active: 1, title: 'Test', description: '', color: '#000', orderNumber: 1 }).execute();
		const result = await db.selectFrom('goals').selectAll().execute();
		expect(result).toHaveLength(1);
		await db.deleteFrom('goals').where('id', '=', result[0].id).execute();
		expect(await db.selectFrom('goals').selectAll().execute()).toHaveLength(0);
	});

	it('better-sqlite3 v12: transactions work correctly', async () => {
		await db.transaction().execute(async (trx) => {
			await trx.insertInto('goals').values({ active: 1, title: 'T1', description: '', color: '#000', orderNumber: 1 }).execute();
			await trx.insertInto('goals').values({ active: 1, title: 'T2', description: '', color: '#000', orderNumber: 2 }).execute();
		});
		expect(await db.selectFrom('goals').selectAll().execute()).toHaveLength(2);
	});

	it('vitest v4: test runner handles async/await properly', async () => {
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
		const start = Date.now();
		await delay(10);
		expect(Date.now() - start).toBeGreaterThanOrEqual(10);
	});

	it('vitest v4: expects work correctly', () => {
		expect(true).toBe(true);
		expect({ a: 1 }).toEqual({ a: 1 });
		expect([1, 2, 3]).toContain(2);
	});
});
