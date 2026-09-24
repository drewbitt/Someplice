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

let fileDbInstance: Kysely<DB> | null = null;

export class DbInstance {
	private static instance: DbInstance | null = null;
	private _db: Kysely<DB>;

	constructor() {
		if (!DbInstance.instance) {
			DbInstance.instance = this;
		}

		let sqlite: DatabaseSync;

		if (process.env.NODE_ENV === 'test') {
			sqlite = new DatabaseSync(':memory:');
			this._db = this.initDb(sqlite);
		} else {
			if (!fileDbInstance) {
				const dbPath = dbFilePath();
				if (!fs.existsSync(dbPath) && process.env.NODE_ENV !== 'migration') {
					dbLogger.fatal(new Error('No db instance found, run migrations first'));
				}

				this.ensureDBDirectoryExists();

				// Path checks for debugging
				try {
					fs.accessSync(path.dirname(dbPath), fs.constants.R_OK | fs.constants.W_OK);
				} catch (err) {
					dbLogger.fatal('No read/write access to data directory', err);
				}

				sqlite = new DatabaseSync(dbPath);
				fileDbInstance = this.initDb(sqlite);
			}
			this._db = fileDbInstance!;
		}
	}

	// Just in case the data directory is missing
	private ensureDBDirectoryExists() {
		const dirPath = path.dirname(dbFilePath());

		if (!fs.existsSync(dirPath)) {
			try {
				fs.mkdirSync(dirPath, { recursive: true });
				dbLogger.info('data directory created');
			} catch (err) {
				dbLogger.fatal('Failed to create data directory', err);
			}
		}
	}

	private initDb(sqlite: DatabaseSync): Kysely<DB> {
		dbLogger.debug('Initializing db instance');
		configureSqlite(sqlite);

		return new Kysely<DB>({
			dialect: createNodeSqliteDialect(sqlite)
		});
	}

	static getInstance(): DbInstance {
		return DbInstance.instance || new DbInstance();
	}

	get db() {
		return this._db;
	}

	setNewTestDb() {
		if (process.env.NODE_ENV === 'test') {
			dbLogger.info('Setting new test db');
			const sqlite = new DatabaseSync(':memory:');
			this._db = this.initDb(sqlite);
		}
	}

	static resetInstance() {
		if (process.env.NODE_ENV === 'test') {
			DbInstance.instance = null;
		}
	}
}
