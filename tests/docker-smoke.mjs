import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

assert.equal(process.getuid?.(), 1000);
assert.ok(process.env.DATABASE_PATH);
using db = new DatabaseSync(process.env.DATABASE_PATH);
db.function('regexp', { deterministic: true }, (pattern, value) =>
	typeof pattern === 'string' && typeof value === 'string' && new RegExp(pattern).test(value)
		? 1
		: 0
);
assert.equal(db.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
assert.equal(db.prepare('SELECT count(*) AS n FROM kysely_migration').get()?.n, 1);

if (process.argv[2] === 'seed') {
	const statement = db.prepare('SELECT 1 AS value');
	assert.ok(Symbol.dispose in statement);
	const dispose = statement[Symbol.dispose];
	assert.ok(typeof dispose === 'function');
	assert.equal(statement.get()?.value, 1);
	dispose.call(statement);
	assert.throws(() => statement.get(), /statement has been finalized/);
	dispose.call(statement);

	using temp = new DatabaseSync(':memory:');
	temp.exec(`
		CREATE TABLE spill(value TEXT);
		WITH RECURSIVE n(x) AS (
			VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000
		)
		INSERT INTO spill SELECT hex(zeroblob(100)) || x FROM n
	`);
	const sorted = temp.prepare('SELECT value FROM spill ORDER BY substr(value,100) DESC').iterate();
	assert.equal(
		sorted.reduce((count) => count + 1, 0),
		100_000
	);

	db.prepare('INSERT INTO goals (active, orderNumber, title, color) VALUES (1, 1, ?, ?)').run(
		'container-persistence-marker',
		'#ffffff'
	);
}
