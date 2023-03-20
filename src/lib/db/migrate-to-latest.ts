import { promises as fs } from 'fs';
import { Kysely, Migrator, type Migration, type MigrationProvider } from 'kysely';
import { pathToFileURL, fileURLToPath } from 'url';
import type { DB } from '../types/data';
import { db as mainDb } from './db';
import os from 'os';
import path from 'path';

export async function migrateToLatest(db?: Kysely<DB>, migrationName?: string) {
	if (!db) {
		db = mainDb;
	}

	const ViteMigrationProvider: MigrationProvider = {
		async getMigrations() {
			const migrations: Record<string, Migration> = {};
			if (os.platform() === 'win32') {
				const files = await fs.readdir('./src/lib/db/migrations');

				for (const file of files) {
					if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
						// Hacky path conversion that works in Windows and probably only Windows
						const filePath = pathToFileURL('./src/lib/db/migrations/' + file).href.replace(
							'file://',
							''
						);

						if (migrationName && file !== migrationName + '.ts' && file !== migrationName + '.js') {
							continue;
						}

						console.log('Found migration ', file);
						const migration = await import(/* @vite-ignore */ filePath);
						const migrationKey = file.substring(0, file.lastIndexOf('.'));
						migrations[migrationKey] = migration;
					}
				}
			} else if (os.platform() === 'linux' || os.platform() === 'darwin') {
				const __dirname = fileURLToPath(new URL('.', import.meta.url));
				const resolvedPath = path.resolve(__dirname, 'migrations');
				const files = await fs.readdir(resolvedPath);

				for (const fileName of files) {
					if (!fileName.endsWith('.js') && !fileName.endsWith('.ts')) {
						continue;
					}

					const importPath = path.join(resolvedPath, fileName).replaceAll('\\', '/');

					/* prettier-ignore */
					if (migrationName && fileName !== migrationName + '.js' && fileName !== migrationName + '.ts') {
						continue;
					}

					console.log('Found migration ', importPath);
					const migration = await import(importPath);
					const migrationKey = fileName.substring(0, fileName.lastIndexOf('.'));

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

if (process.argv[2] === '--migration') {
	migrateToLatest(undefined, process.argv[3]);
} else {
	migrateToLatest();
}
