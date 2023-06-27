import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from '../types/data';

const betterSqlite3 = new Database('./src/lib/db/db.sqlite');
// Define REGEXP function
betterSqlite3.function('regexp', { deterministic: true }, (regex: unknown, text: unknown) => {
	if (typeof regex === 'string' && typeof text === 'string') {
		return new RegExp(regex).test(text) ? 1 : 0;
	}
});

export const db = new Kysely<DB>({
	dialect: new SqliteDialect({
		database: betterSqlite3
	})
});
