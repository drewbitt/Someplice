import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Kysely, sql } from 'kysely';
import { DatabaseSync } from 'node:sqlite';
import type { DB } from '../types/data';
import { createNodeSqliteDialect } from './node-sqlite.ts';
import { configureSqlite } from './db.ts';
import { runMigrations } from './migrate-to-latest.ts';
import * as m001 from './migrations/001_schema.ts';

const APP_TABLES = ['goal_logs', 'goals', 'intentions', 'outcomes', 'outcomes_intentions'].sort();
const APP_INDEXES = [
	'idx_goal_logs_goalId_date',
	'idx_intentions_date',
	'idx_intentions_goalId',
	'idx_outcomes_intentions_intentionId',
	'uq_goals_active_orderNumber',
	'uq_intentions_date_orderNumber'
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
		await runMigrations(db);
	});

	afterAll(async () => {
		await db.destroy();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('creates all app tables and indexes on a fresh database', async () => {
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).sort()).toEqual(APP_INDEXES);
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

	it('down leaves no app tables', async () => {
		await m001.down(migrationDb);
		expect(await listObjects(db, 'table')).toEqual([]);
		expect(await listObjects(db, 'index')).toEqual([]);

		// re-apply to prove the pair is symmetric
		await m001.up(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).sort()).toEqual(APP_INDEXES);
	});
});
