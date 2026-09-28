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
import * as m002 from './migrations/002_intention_status.ts';
import * as m003 from './migrations/003_outcome_verdicts.ts';
import * as m004 from './migrations/004_priorities.ts';

const APP_TABLES = [
	'goal_logs',
	'goals',
	'intentions',
	'outcome_verdicts',
	'outcomes',
	'outcomes_intentions',
	'priorities'
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

	it('intention status backfills from completed on upgrade and downgrade', async () => {
		await m002.down(migrationDb);

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

		await sql`
			insert into intentions (goalId, orderNumber, completed, text, subIntentionQualifier, date)
			values (1, 1, 1, 'done item', null, '2023-07-01T00:01:00.000Z'),
			       (1, 2, 0, 'pending item', null, '2023-07-01T00:02:00.000Z')
		`.execute(db);

		await m002.up(migrationDb);

		const rows = await db
			.selectFrom('intentions')
			.select(['status', 'orderNumber'])
			.orderBy('orderNumber')
			.execute();
		expect(rows.map((r) => r.status)).toEqual(['done', 'pending']);

		await m002.down(migrationDb);
		const downgradedRows = await sql<{ completed: number }>`
			select completed from intentions order by orderNumber
		`.execute(db);
		expect(downgradedRows.rows.map((r) => r.completed)).toEqual([1, 0]);
		await m002.up(migrationDb);
	});

	it('every migration with a down() rolls back cleanly', async () => {
		await m004.down(migrationDb);
		await m003.down(migrationDb);
		await m002.down(migrationDb);
		await m001.down(migrationDb);
		expect(await listObjects(db, 'table')).toEqual([]);
		expect(await listObjects(db, 'index')).toEqual([]);

		await m001.up(migrationDb);
		await m002.up(migrationDb);
		await m003.up(migrationDb);
		await m004.up(migrationDb);
		expect((await listObjects(db, 'table')).sort()).toEqual(APP_TABLES);
		expect((await listObjects(db, 'index')).sort()).toEqual(APP_INDEXES);
	});
});
