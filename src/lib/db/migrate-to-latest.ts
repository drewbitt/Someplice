import { pathToFileURL } from 'node:url';
import { Kysely } from 'kysely';
import { Migrator } from 'kysely/migration';
import type { DB } from '../types/data';
import { dbLogger } from '../utils/logger.ts';
import { getDb } from './db.ts';
import * as initial from './migrations/001_initial.ts';

const provider = { getMigrations: async () => ({ '001_initial': initial }) };

export async function runMigrations(db: Kysely<DB>): Promise<void> {
	const { error, results } = await new Migrator({ db, provider }).migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			dbLogger.debug(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			dbLogger.error(`failed to execute migration "${it.migrationName}"`);
		}
	});
	dbLogger.info(
		results && results.length > 0 ? `Ran ${results.length} migrations` : 'No new migrations to run.'
	);

	if (error) {
		throw error instanceof Error ? error : new Error(String(error));
	}
}

// Run as a CLI only when invoked directly (e.g. `node ./src/lib/db/migrate-to-latest.ts`).
const isMainModule =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
	runMigrations(getDb())
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : error);
			process.exitCode = 1;
		})
		.finally(() => getDb().destroy());
}
