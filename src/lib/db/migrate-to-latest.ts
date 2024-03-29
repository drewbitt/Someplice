import { Kysely, Migrator, type Migration, type MigrationProvider } from 'kysely';
import type { DB } from '../types/data';
import { dbLogger } from '$src/lib/utils/logger';
import { DbInstance } from './db';

export async function migrateToLatest(db?: Kysely<DB>, migrationName?: string) {
	if (process.env.NODE_ENV !== 'test') {
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
	if (results?.length === 0) {
		dbLogger.info('No new migrations to run.');
	} else {
		dbLogger.info(`Ran ${results?.length} migrations`);
	}

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		if (process.env.NODE_ENV !== 'test') {
			process.exit(1);
		}
	}

	if (process.env.NODE_ENV !== 'test') {
		await db.destroy();
	}
}

if (process.argv[2] === '--migration') {
	migrateToLatest(undefined, process.argv[3]);
} else {
	migrateToLatest();
}
