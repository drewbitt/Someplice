import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Kysely, sql } from 'kysely';
import { DatabaseSync } from 'node:sqlite';
import type { DB } from '../types/data';
import { createNodeSqliteDialect } from './node-sqlite.ts';
import { configureSqlite } from './db.ts';
import { migrateToLatest, runMigrations } from './migrate-to-latest.ts';
import * as m001 from './migrations/001_create_tables.ts';
import * as m003 from './migrations/003_goal_logs.ts';
import * as m004 from './migrations/004_indexes.ts';
import * as m006 from './migrations/006_intention_status.ts';

const APP_TABLES = ['goal_logs', 'goals', 'intentions', 'outcomes', 'outcomes_intentions'].sort();

const listObjects = async (db: Kysely<DB>, type: 'table' | 'index') =>
	(
		await sql<{ name: string }>`
		select name from sqlite_master
		where type = ${type} and name not like 'sqlite_%' and name not like 'kysely_%'
	`.execute(db)
	).rows.map((r) => r.name);

describe('migrations', () => {
	let dir: string;
	let db: Kysely<DB>;
	// migration fns take Kysely<unknown>; one alias instead of a cast per call
	let migrationDb: Kysely<unknown>;

	beforeAll(async () => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'someplice-'));
		const sqlite = new DatabaseSync(path.join(dir, 'test.sqlite'));
		configureSqlite(sqlite);
		db = new Kysely<DB>({ dialect: createNodeSqliteDialect(sqlite) });
		migrationDb = db as unknown as Kysely<unknown>;
		await migrateToLatest(db);
	});

	afterAll(async () => {
		await db.destroy();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('creates all app tables and indexes on a fresh database', async () => {
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).length).toBeGreaterThan(0);
	});

	it('runMigrations is idempotent on a fresh in-memory database', async () => {
		const memSqlite = new DatabaseSync(':memory:');
		configureSqlite(memSqlite);
		const memDb = new Kysely<DB>({ dialect: createNodeSqliteDialect(memSqlite) });
		try {
			await runMigrations(memDb);
			expect((await listObjects(memDb, 'table')).sort()).toEqual(APP_TABLES);
			// second call runs 0 migrations and does not throw
			await runMigrations(memDb);
			expect((await listObjects(memDb, 'table')).sort()).toEqual(APP_TABLES);
		} finally {
			await memDb.destroy();
		}
	});

	it('migrateToLatest is idempotent', async () => {
		await migrateToLatest(db);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
	});

	it('intention status backfills from completed on upgrade and downgrade', async () => {
		// oldest schema: intentions has completed (0/1), no status
		await m006.down(migrationDb);

		await db
			.insertInto('goals')
			.values({
				active: 1,
				title: 'g',
				description: null,
				color: 'hsl(0, 0%, 50%)',
				orderNumber: 1
			})
			.execute();

		// pre-migration rows — the `completed` column predates the typed schema
		await sql`
			insert into intentions (goalId, orderNumber, completed, text, subIntentionQualifier, date)
			values (1, 1, 1, 'done item', null, '2023-07-01T00:01:00.000Z'),
			       (1, 2, 0, 'pending item', null, '2023-07-01T00:02:00.000Z')
		`.execute(db);

		await m006.up(migrationDb);

		const rows = await db
			.selectFrom('intentions')
			.select(['status', 'orderNumber'])
			.orderBy('orderNumber')
			.execute();
		expect(rows.map((r) => r.status)).toEqual(['done', 'pending']);
	});

	it('every migration with a down() rolls back cleanly', async () => {
		await m006.down(migrationDb);

		await m004.down(migrationDb);
		expect(await listObjects(db, 'index')).toEqual([]);

		await m003.down(migrationDb);
		expect(await listObjects(db, 'table')).not.toContain('goal_logs');

		// m002 has no down(), so the outcomes tables it created remain
		await m001.down(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(
			['outcomes', 'outcomes_intentions'].sort()
		);

		// re-apply to prove the pairs are symmetric
		await m001.up(migrationDb);
		await m003.up(migrationDb);
		await m004.up(migrationDb);
		await m006.up(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).length).toBeGreaterThan(0);
	});
});
