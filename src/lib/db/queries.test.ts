import { configureSqlite } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import type { DB } from '#lib/types/data.js';
import { Kysely, sql } from 'kysely';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqliteDialect } from './node-sqlite.ts';
import { deleteOrphanedOutcomes } from './queries';

describe('outcome query helpers', () => {
	let db: Kysely<DB>;
	let queries: string[];

	beforeEach(async () => {
		const sqlite = new DatabaseSync(':memory:');
		configureSqlite(sqlite);
		queries = [];
		db = new Kysely<DB>({
			dialect: createNodeSqliteDialect(sqlite),
			log(event) {
				if (event.level === 'query') queries.push(event.query.sql);
			}
		});
		await runMigrations(db);
		queries = [];
	});

	afterEach(async () => {
		await db.destroy();
	});

	it('does not delete anything or execute SQL for an empty candidate list', async () => {
		await db.insertInto('outcomes').values({ date: '2023-07-01', reviewed: 0 }).execute();
		queries = [];
		await deleteOrphanedOutcomes(db, []);
		expect(queries).toHaveLength(0);
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(1);
	});

	it('only deletes specified orphans and preserves intention links and verdicts', async () => {
		await db
			.insertInto('goals')
			.values({ id: 1, active: 1, orderNumber: 1, title: 'Read', color: 'navy' })
			.execute();
		await db
			.insertInto('intentions')
			.values({
				id: 1,
				goalId: 1,
				orderNumber: 1,
				status: 'pending',
				text: 'Read',
				date: '2023-07-01T00:00:00.000Z'
			})
			.execute();
		await db
			.insertInto('outcomes')
			.values([1, 2, 3, 4].map((id) => ({ id, reviewed: 1, date: `2023-07-0${id}` })))
			.execute();
		await db.insertInto('outcomes_intentions').values({ outcomeId: 1, intentionId: 1 }).execute();
		await db
			.insertInto('outcome_verdicts')
			.values({ outcomeId: 2, goalId: 1, verdict: 'enough' })
			.execute();
		queries = [];
		await deleteOrphanedOutcomes(db, [1, 2, 3, 3, 999]);
		expect(queries).toHaveLength(1);
		expect(
			(await db.selectFrom('outcomes').select('id').orderBy('id').execute()).map((row) => row.id)
		).toEqual([1, 2, 4]);
	});

	const seedOutcomes = async (count: number) => {
		for (let offset = 0; offset < count; offset += 500) {
			await db
				.insertInto('outcomes')
				.values(
					Array.from({ length: Math.min(500, count - offset) }, (_, i) => {
						const id = offset + i + 1;
						const date = new Date(Date.UTC(2020, 0, id)).toISOString().slice(0, 10);
						return { id, date, reviewed: 0 };
					})
				)
				.execute();
		}
	};

	it('cleans large histories in bounded batches rather than querying each outcome', async () => {
		await seedOutcomes(1002);
		queries = [];
		await deleteOrphanedOutcomes(
			db,
			Array.from({ length: 1001 }, (_, i) => i + 1)
		);
		expect(queries).toHaveLength(2);
		expect(await db.selectFrom('outcomes').select('id').execute()).toEqual([{ id: 1002 }]);
	});

	it('keeps all batches inside the caller transaction when a later delete fails', async () => {
		await seedOutcomes(1001);
		await sql`
			CREATE TRIGGER fail_cleanup BEFORE DELETE ON outcomes
			WHEN OLD.id = 1001 BEGIN SELECT RAISE(ABORT, 'blocked'); END
		`.execute(db);
		await expect(
			db.transaction().execute((trx) =>
				deleteOrphanedOutcomes(
					trx,
					Array.from({ length: 1001 }, (_, i) => i + 1)
				)
			)
		).rejects.toThrow('blocked');
		expect(await db.selectFrom('outcomes').select('id').execute()).toHaveLength(1001);
	});
});
