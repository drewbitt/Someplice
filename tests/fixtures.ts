import { DatabaseSync } from 'node:sqlite';

export function openTestDb() {
	const db = new DatabaseSync(process.env.DATABASE_PATH!);
	db.exec('PRAGMA foreign_keys = ON');
	db.function('regexp', { deterministic: true }, (regex, text) =>
		typeof regex === 'string' && typeof text === 'string'
			? new RegExp(regex).test(text)
				? 1
				: 0
			: null
	);
	return db;
}

export function resetTestDb() {
	const db = openTestDb();
	try {
		db.exec('DELETE FROM goals; DELETE FROM outcomes; DELETE FROM settings;');
	} finally {
		db.close();
	}
}
