import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { GenericSqliteDialect } from 'kysely-generic-sqlite';

// node:sqlite's StatementSync differs from better-sqlite3: bind params are
// spread into statement calls rather than passed as an array, and there is no
// `stmt.reader` flag, so read-vs-write is derived from `stmt.columns()`.
// Rows are spread into plain objects since node:sqlite returns
// null-prototype records.
export function createNodeSqliteDialect(database: DatabaseSync) {
	const dialect = new GenericSqliteDialect(() => ({
		db: database,
		query: (_isSelect, sql, parameters) => {
			const stmt = database.prepare(sql);
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
				for (const row of database.prepare(sql).iterate(...params)) {
					yield { ...row };
				}
			})();
		},
		close: () => database.close()
	}));
	// SQLite DDL is transactional, but Kysely's SqliteAdapter conservatively
	// reports supportsTransactionalDdl=false — without this, the Migrator runs
	// each migration unwrapped and a mid-DDL failure leaves partial tables.
	const createAdapter = dialect.createAdapter.bind(dialect);
	dialect.createAdapter = () => {
		const adapter = createAdapter();
		Object.defineProperty(adapter, 'supportsTransactionalDdl', { value: true });
		return adapter;
	};
	return dialect;
}
