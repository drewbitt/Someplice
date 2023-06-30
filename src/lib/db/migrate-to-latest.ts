import { Kysely, Migrator, type Migration, type MigrationProvider } from 'kysely';
import type { DB } from '../types/data';
import { db as mainDb } from './db';

export async function migrateToLatest(db?: Kysely<DB>, migrationName?: string) {
	if (!db) {
		db = mainDb;
	}

	const ViteMigrationProvider: MigrationProvider = {
		async getMigrations() {
			const migrations: Record<string, Migration> = import.meta.glob('./migrations/**.ts', {
				eager: true
			});
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
			console.log(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});
	console.log(`Ran ${results?.length} migrations`);

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
}

if (process.argv[2] === '--migration') {
	migrateToLatest(undefined, process.argv[3]);
} else {
	migrateToLatest();
}
