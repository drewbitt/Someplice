import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator, type Migration } from 'kysely/migration';
import type { DB } from '../types/data';
import { dbLogger } from '../utils/logger.ts';
import { getDb } from './db.ts';

// Under Vite the migration modules must be discovered statically so they get
// bundled; import.meta.env exists only there. The CLI path runs under plain
// node and falls back to reading the directory. Basename keys keep the
// migration name ('001_schema') identical across both providers.
const provider = import.meta.env
	? {
			getMigrations: async () =>
				Object.fromEntries(
					Object.entries(import.meta.glob<Migration>('./migrations/*.ts', { eager: true })).map(
						([key, migration]) => [path.basename(key, '.ts'), migration]
					)
				)
		}
	: new FileMigrationProvider({
			fs: fs.promises,
			path,
			migrationFolder: fileURLToPath(new URL('./migrations', import.meta.url))
		});

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
		.then(() => getDb().destroy())
		.catch(() => {
			process.exitCode = 1;
		});
}
