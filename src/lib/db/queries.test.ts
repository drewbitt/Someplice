import { createDb, getDb, setDb } from '#src/lib/db/db.js';
import { runMigrations } from '#src/lib/db/migrate-to-latest.js';
import type { DB } from '#src/lib/types/data.js';
import type { Kysely } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { ensureOutcomeForDate } from './queries';

describe('ensureOutcomeForDate', () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		setDb(createDb(':memory:'));
		db = getDb();
		await runMigrations(db);
	});

	it('creates the outcome once and always returns the same id', async () => {
		const id = await ensureOutcomeForDate(db, '2023-07-01');
		const again = await ensureOutcomeForDate(db, '2023-07-01');
		expect(id).not.toBeNull();
		expect(again).toBe(id);
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(1);
	});

	it('concurrent calls for the same date both succeed', async () => {
		const [a, b] = await Promise.all([
			ensureOutcomeForDate(db, '2023-07-02'),
			ensureOutcomeForDate(db, '2023-07-02')
		]);
		expect(a).toBe(b);
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(1);
	});
});
