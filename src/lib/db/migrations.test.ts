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
import * as initial from './migrations/001_initial.ts';

const APP_TABLES = [
	'goal_logs',
	'goals',
	'intentions',
	'outcome_verdicts',
	'outcomes',
	'outcomes_intentions',
	'priorities',
	'settings'
].sort();
const APP_INDEXES = [
	'idx_goal_logs_goalId_date',
	'idx_intentions_date',
	'idx_intentions_goalId',
	'idx_outcomes_intentions_intentionId',
	'uq_goals_active_orderNumber',
	'uq_intentions_date_orderNumber',
	'uq_outcome_verdicts_outcomeId_goalId',
	'uq_priorities_active_goalId'
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
			await runMigrations(memDb);
			expect((await listObjects(memDb, 'table')).sort()).toEqual(APP_TABLES);
		} finally {
			await memDb.destroy();
		}
	});

	it('creates the current status schema without the obsolete completed field', async () => {
		const columns = await sql<{
			name: string;
			dflt_value: string | null;
		}>`PRAGMA table_info(intentions)`.execute(db);
		expect(columns.rows.some((column) => column.name === 'completed')).toBe(false);
		expect(columns.rows.find((column) => column.name === 'status')?.dflt_value).toBe("'pending'");
		expect((await sql`SELECT * FROM kysely_migration`.execute(db)).rows).toHaveLength(1);
	});

	it('refuses obsolete migration metadata without rewriting user data', async () => {
		const goal = {
			active: 1,
			orderNumber: 1,
			title: 'Keep my data',
			description: null,
			color: 'red'
		};
		await db.insertInto('goals').values(goal).execute();
		await sql`UPDATE kysely_migration SET name = '001_schema'`.execute(db);
		try {
			await expect(runMigrations(db)).rejects.toThrow();
			expect(await db.selectFrom('goals').selectAll().execute()).toMatchObject([goal]);
			expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		} finally {
			await sql`UPDATE kysely_migration SET name = '001_initial'`.execute(db);
			await db.deleteFrom('goals').execute();
		}
	});

	it('the baseline rolls back and rebuilds cleanly', async () => {
		await initial.down(migrationDb);
		expect(await listObjects(db, 'table')).toEqual([]);
		expect(await listObjects(db, 'index')).toEqual([]);

		await initial.up(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).sort()).toEqual(APP_INDEXES);
	});
});
