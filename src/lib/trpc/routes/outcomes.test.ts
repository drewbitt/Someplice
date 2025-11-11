import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import { sql, type Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OutcomeSchema } from './outcomes';

describe('outcomes', () => {
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

	it('raw SQL template literals work with type safety', async () => {
		await db.insertInto('goals').values({ active: 1, title: 'Test', description: '', color: '#000', orderNumber: 1 }).execute();
		const result = await sql<{ count: number }>`SELECT COUNT(*) as count FROM goals WHERE active = 1`.execute(db);
		expect(result.rows[0].count).toBe(1);
	});

	it('schema validates date format', () => {
		expect(() => OutcomeSchema.parse({ id: null, reviewed: 0, date: '2024-01-01' })).not.toThrow();
		expect(() => OutcomeSchema.parse({ reviewed: 0, date: '2024-01-01T00:00:00' })).toThrow();
	});
});
