import { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import type { DB } from '../types/data';
import { dbLogger } from '$src/lib/utils/logger';
import { DbInstance } from './db';

export async function migrateToLatest(db?: Kysely<DB>, migrationName?: string) {
	const isTest = process.env.NODE_ENV === 'test';
	if (!isTest && process.env.NODE_ENV !== 'migration') {
		process.env.NODE_ENV = 'migration';
	}
	db = db || DbInstance.getInstance().db;

	const ViteMigrationProvider: MigrationProvider = {
		async getMigrations() {
			const migrations: Record<string, Migration> = import.meta.glob('./migrations/**.ts', {
				eager: true
			});

			if (migrationName) {
				for (const key in migrations) {
					if (key.includes(migrationName)) {
						return { [key]: migrations[key] };
					}
				}

				throw new Error(`Migration ${migrationName} not found`);
			}

			return migrations;
		}
	};

	const migrator = new Migrator({
		db,
		provider: ViteMigrationProvider
	});

	const { error, results } = await migrator.migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			dbLogger.debug(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});
	if (!results || results.length === 0) {
		dbLogger.info('No new migrations to run.');
	} else {
		dbLogger.info(`Ran ${results.length} migrations`);
	}

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		if (!isTest) {
			process.exit(1);
		}
	}

	if (!isTest) {
		await db.destroy();
	}
}

// Run as a CLI only when invoked directly (e.g. `vite-node ./src/lib/db/migrate-to-latest.ts`).
// Imports by tests / app code must not trigger a module-level migration, which was destroying
// the DbInstance singleton's driver before tests could run their beforeEach setup.
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
	const migrationName = process.argv[2] === '--migration' ? process.argv[3] : undefined;
	migrateToLatest(undefined, migrationName);
}
