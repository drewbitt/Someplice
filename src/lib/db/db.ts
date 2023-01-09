import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { GoalTable, IntentionTable } from '../types/data';
import { migrateToLatest } from './migrate-to-latest';

export interface DatabaseConfig {
	goals: GoalTable[];
	intentions: IntentionTable[];
}

export const db = new Kysely<DatabaseConfig>({
	dialect: new SqliteDialect({
		database: new Database('db.sqlite')
	})
});

await migrateToLatest(db);