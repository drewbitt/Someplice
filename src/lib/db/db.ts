import { dbLogger } from '$src/lib/utils/logger';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { DB } from '../types/data';

let fileDbInstance: Kysely<DB> | null = null;

export class DbInstance {
	private static instance: DbInstance | null = null;
	private _db: Kysely<DB>;

	constructor() {
		if (!DbInstance.instance) {
			DbInstance.instance = this;
		}

		let betterSqlite3: InstanceType<typeof Database>;

		if (process.env.NODE_ENV === 'test') {
			betterSqlite3 = new Database(':memory:');
			this._db = this.initDb(betterSqlite3);
		} else {
			if (!fileDbInstance) {
				betterSqlite3 = new Database('./src/lib/db/db.sqlite');
				fileDbInstance = this.initDb(betterSqlite3);
			}
			this._db = fileDbInstance!;
		}
	}

	private initDb(betterSqlite3: InstanceType<typeof Database>): Kysely<DB> {
		dbLogger.debug('Initializing db instance');
		// Define REGEXP function
		betterSqlite3.function('regexp', { deterministic: true }, (regex: unknown, text: unknown) => {
			if (typeof regex === 'string' && typeof text === 'string') {
				return new RegExp(regex).test(text) ? 1 : 0;
			}
		});

		return new Kysely<DB>({
			dialect: new SqliteDialect({
				database: betterSqlite3
			})
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
			const betterSqlite3 = new Database(':memory:');
			this._db = this.initDb(betterSqlite3);
		}
	}

	static resetInstance() {
		if (process.env.NODE_ENV === 'test') {
			DbInstance.instance = null;
		}
	}
}
