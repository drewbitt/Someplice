import { dbLogger } from '../utils/logger.ts';
import { createNodeSqliteDialect } from './node-sqlite.ts';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { Kysely } from 'kysely';
import type { DB } from '../types/data';
import fs from 'node:fs';
import path from 'node:path';

const dbFilePath = () => process.env.DATABASE_PATH ?? './data/db.sqlite';

// Shared by the app and tests: REGEXP must exist before any intentions writes
// (the table has a CHECK that uses it)
export const configureSqlite = (sqlite: DatabaseSync): void => {
	sqlite.exec('PRAGMA journal_mode = WAL');
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.function(
		'regexp',
		{ deterministic: true },
		(regex: SQLOutputValue, text: SQLOutputValue) => {
			if (typeof regex === 'string' && typeof text === 'string') {
				return new RegExp(regex).test(text) ? 1 : 0;
			}
			return null;
		}
	);
};

export const createDb = (filePath: string): Kysely<DB> => {
	if (filePath !== ':memory:') {
		const dirPath = path.dirname(filePath);
		if (!fs.existsSync(dirPath)) {
			try {
				fs.mkdirSync(dirPath, { recursive: true });
				dbLogger.info('data directory created');
			} catch (err) {
				dbLogger.fatal('Failed to create data directory', err);
			}
		}
	}

	dbLogger.debug('Initializing db instance');
	const sqlite = new DatabaseSync(filePath);
	configureSqlite(sqlite);

	return new Kysely<DB>({
		dialect: createNodeSqliteDialect(sqlite)
	});
};

let db: Kysely<DB> | null = null;

export const getDb = (): Kysely<DB> => {
	if (!db) {
		if (process.env.NODE_ENV === 'test') {
			db = createDb(':memory:');
		} else {
			const filePath = dbFilePath();
			if (!fs.existsSync(filePath)) {
				dbLogger.info('No database file found; it will be created and migrated on startup');
			}
			db = createDb(filePath);
		}
	}
	return db;
};

// Tests only: point getDb() at a fresh database (usually createDb(':memory:'))
export const setDb = (newDb: Kysely<DB>): void => {
	db = newDb;
};
