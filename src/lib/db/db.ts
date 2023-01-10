import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Goals, Intentions } from '../types/data';

export interface DB {
	goals: Goals;
	intentions: Intentions;
}

export const db = new Kysely<DB>({
	dialect: new SqliteDialect({
		database: new Database('./src/lib/db/db.sqlite')
	})
});
