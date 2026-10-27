import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
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

function disposeStatement(statement: StatementSync): void {
	// @types/node 24.19.2 omits statement disposal (added in Node 24.22.0).
	const dispose = Symbol.dispose in statement ? statement[Symbol.dispose] : undefined;
	if (typeof dispose === 'function') {
		dispose.call(statement);
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
			const stmt = database.prepare(sql);
			try {
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
			} finally {
				disposeStatement(stmt);
			}
		},
		iterator: (_isSelect, sql, parameters) => {
			const params = parameters as SQLInputValue[];
			return (function* () {
				const stmt = database.prepare(sql);
				try {
					for (const row of stmt.iterate(...params)) {
						yield { ...row };
					}
				} finally {
					disposeStatement(stmt);
				}
			})();
		},
		close: () => database.close()
	}));
}
