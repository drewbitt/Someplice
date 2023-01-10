import { promises as fs } from 'fs';
import { Kysely, Migrator, type Migration, type MigrationProvider } from 'kysely';
import { pathToFileURL } from 'url';
import type { DB } from '../types/data';
import { db as mainDb } from './db';

export async function migrateToLatest(db?: Kysely<DB>) {
	if (!db) {
		db = mainDb;
	}

	const ViteMigrationProvider: MigrationProvider = {
		async getMigrations() {
			const migrations: Record<string, Migration> = {};
			const files = await fs.readdir('./src/lib/db/migrations');

			for (const file of files) {
				if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
					// Hacky path conversion that works in Windows and probably only Windows
					const filePath = pathToFileURL('./src/lib/db/migrations/' + file).href.replace(
						'file://',
						''
					);
					console.log('🚀 ~ file: migrate-to-latest.ts:22 ~ getMigrations ~ filePath', filePath);
					const migration = await import(/* @vite-ignore */ filePath);
					const migrationKey = file.substring(0, file.lastIndexOf('.'));
					migrations[migrationKey] = migration;
				}
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
			console.log(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		process.exit(1);
	}

	await db.destroy();
}

migrateToLatest();
