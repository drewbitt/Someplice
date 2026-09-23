import {
	DatabaseSync,
	type SQLInputValue,
	type SQLOutputValue,
	type StatementSync
} from 'node:sqlite';
import type { SqliteDatabase, SqliteStatement } from 'kysely';

// Thin adapter so node:sqlite satisfies Kysely's SqliteDatabase contract:
// it expects statements to expose `reader` and to take bind params as an array.
// node:sqlite also returns rows as null-prototype objects; spread them back
// into plain objects to match better-sqlite3's observable behavior.
class NodeSqliteStatement implements SqliteStatement {
	private readonly stmt: StatementSync;

	constructor(stmt: StatementSync) {
		this.stmt = stmt;
	}

	get reader() {
		return this.stmt.columns().length > 0;
	}

	all(parameters: readonly unknown[]) {
		return this.stmt.all(...(parameters as SQLInputValue[])).map((row) => ({ ...row }));
	}

	run(parameters: readonly unknown[]) {
		return this.stmt.run(...(parameters as SQLInputValue[]));
	}

	*iterate(parameters: readonly unknown[]) {
		for (const row of this.stmt.iterate(...(parameters as SQLInputValue[]))) {
			yield { ...row };
		}
	}
}

export class NodeSqliteDatabase implements SqliteDatabase {
	private readonly db: DatabaseSync;

	constructor(pathOrMemory: string) {
		this.db = new DatabaseSync(pathOrMemory);
	}

	exec(sql: string) {
		this.db.exec(sql);
	}

	function(
		name: string,
		options: { deterministic?: boolean },
		fn: (...args: unknown[]) => unknown
	) {
		// better-sqlite3 treats an undefined return as SQL NULL; match that
		const wrapped = (...args: SQLOutputValue[]) => {
			const result = fn(...args);
			return result === undefined ? null : (result as SQLInputValue);
		};
		// node:sqlite derives the SQL arity from func.length — keep it identical
		// to the wrapped function so arity checking still rejects wrong arg counts.
		Object.defineProperty(wrapped, 'length', { value: fn.length });
		this.db.function(name, options, wrapped);
	}

	prepare(sql: string) {
		return new NodeSqliteStatement(this.db.prepare(sql));
	}

	close() {
		this.db.close();
	}
}
