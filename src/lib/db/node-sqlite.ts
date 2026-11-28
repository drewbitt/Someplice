import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { SqliteAdapter } from 'kysely';
import { GenericSqliteDialect } from 'kysely-generic-sqlite';

class NodeSqliteAdapter extends SqliteAdapter {
	// SQLite DDL is transactional. Let the Migrator wrap migrations so a
	// mid-DDL failure rolls back instead of leaving partial tables.
	override get supportsTransactionalDdl(): boolean {
		return true;
	}
}

class NodeSqliteDialect extends GenericSqliteDialect {
	override createAdapter(): NodeSqliteAdapter {
		return new NodeSqliteAdapter();
	}
}

// The supported Node runtime has statement disposal since v26.8.0.
// The current @types/node declarations still lack it.
declare module 'node:sqlite' {
	interface StatementSync {
		[Symbol.dispose](): void;
	}
}

// node:sqlite's StatementSync differs from better-sqlite3: bind params are
// spread into statement calls rather than passed as an array, and there is no
// `stmt.reader` flag, so read-vs-write is derived from `stmt.columns()`.
// Rows are spread into plain objects since node:sqlite returns
// null-prototype records.
export function createNodeSqliteDialect(database: DatabaseSync) {
	return new NodeSqliteDialect(() => ({
		db: database,
		query: (_isSelect, sql, parameters) => {
			using stmt = database.prepare(sql);
			const params = parameters as SQLInputValue[];
			if (stmt.columns().length > 0) {
				return { rows: stmt.all(...params).map((row) => ({ ...row })) };
			}
			const { changes, lastInsertRowid } = stmt.run(...params);
			return {
				rows: [],
				insertId: BigInt(lastInsertRowid),
				numAffectedRows: BigInt(changes)
			};
		},
		iterator: (_isSelect, sql, parameters) => {
			const params = parameters as SQLInputValue[];
			return (function* () {
				using stmt = database.prepare(sql);
				for (const row of stmt.iterate(...params)) {
					yield { ...row };
				}
			})();
		},
		close: () => database.close()
	}));
}
