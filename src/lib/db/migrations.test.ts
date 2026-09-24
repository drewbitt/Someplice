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
import * as m005 from './migrations/005_outcome_verdicts.ts';

const APP_TABLES = [
	'goal_logs',
	'goals',
	'intentions',
	'outcome_verdicts',
	'outcomes',
	'outcomes_intentions'
].sort();

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

	it('every migration with a down() rolls back cleanly', async () => {
		await m005.down(migrationDb);
		expect(await listObjects(db, 'table')).not.toContain('outcome_verdicts');

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
		await m005.up(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).length).toBeGreaterThan(0);
	});
});
