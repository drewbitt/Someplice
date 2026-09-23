import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
	CompiledQuery,
	SelectQueryNode,
	SqliteAdapter,
	SqliteIntrospector,
	SqliteQueryCompiler,
	type DatabaseConnection,
	type DatabaseIntrospector,
	type Dialect,
	type DialectAdapter,
	type Driver,
	type Kysely,
	type QueryCompiler,
	type QueryResult
} from 'kysely';

export interface NodeSqliteDialectConfig {
	database: DatabaseSync;
}

/**
 * Kysely dialect backed by Node's built-in `node:sqlite`.
 *
 * Reuses Kysely's SqliteAdapter/Introspector/QueryCompiler — only the driver
 * differs from the bundled SqliteDialect (which targets better-sqlite3):
 * bound parameters are spread into statement calls rather than passed as an
 * array, and there is no `stmt.reader` flag, so read-vs-write is derived from
 * `stmt.columns()`. Rows are spread into plain objects since node:sqlite
 * returns null-prototype records.
 */
export class NodeSqliteDialect implements Dialect {
	private readonly config: NodeSqliteDialectConfig;

	constructor(config: NodeSqliteDialectConfig) {
		this.config = config;
	}

	createDriver(): Driver {
		return new NodeSqliteDriver(this.config);
	}

	createQueryCompiler(): QueryCompiler {
		return new SqliteQueryCompiler();
	}

	createAdapter(): DialectAdapter {
		return new SqliteAdapter();
	}

	createIntrospector(db: Kysely<unknown>): DatabaseIntrospector {
		return new SqliteIntrospector(db);
	}
}

class NodeSqliteDriver implements Driver {
	private readonly config: NodeSqliteDialectConfig;
	private connection: NodeSqliteConnection | null = null;

	constructor(config: NodeSqliteDialectConfig) {
		this.config = config;
	}

	async init(): Promise<void> {
		this.connection = new NodeSqliteConnection(this.config.database);
	}

	async acquireConnection(): Promise<DatabaseConnection> {
		return this.connection!;
	}

	async beginTransaction(connection: DatabaseConnection): Promise<void> {
		await connection.executeQuery(CompiledQuery.raw('begin'));
	}

	async commitTransaction(connection: DatabaseConnection): Promise<void> {
		await connection.executeQuery(CompiledQuery.raw('commit'));
	}

	async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
		await connection.executeQuery(CompiledQuery.raw('rollback'));
	}

	async releaseConnection(): Promise<void> {
		// noop — single connection
	}

	async destroy(): Promise<void> {
		this.config.database.close();
	}
}

class NodeSqliteConnection implements DatabaseConnection {
	private readonly db: DatabaseSync;

	constructor(db: DatabaseSync) {
		this.db = db;
	}

	async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
		const stmt = this.db.prepare(compiledQuery.sql);
		const parameters = compiledQuery.parameters as SQLInputValue[];

		if (stmt.columns().length > 0) {
			return { rows: stmt.all(...parameters).map((row) => ({ ...row }) as R) };
		}

		const { changes, lastInsertRowid } = stmt.run(...parameters);
		return {
			insertId: BigInt(lastInsertRowid),
			numAffectedRows: BigInt(changes),
			rows: []
		};
	}

	async *streamQuery<R>(compiledQuery: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
		if (!SelectQueryNode.is(compiledQuery.query)) {
			throw new Error('NodeSqlite driver only supports streaming of select queries');
		}

		const stmt = this.db.prepare(compiledQuery.sql);
		const parameters = compiledQuery.parameters as SQLInputValue[];

		for (const row of stmt.iterate(...parameters)) {
			yield { rows: [{ ...row } as R] };
		}
	}
}
