import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { Kysely, sql } from 'kysely';
import { createNodeSqliteDialect } from './node-sqlite.ts';

interface TestDatabase {
	items: { id: number; value: string };
}

describe('node:sqlite statement lifetime', () => {
	let sqlite: DatabaseSync;
	let db: Kysely<TestDatabase>;
	let statements: StatementSync[];

	beforeEach(() => {
		sqlite = new DatabaseSync(':memory:');
		sqlite.exec(`
			CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE);
			INSERT INTO items VALUES (1, 'first'), (2, 'second'), (3, 'third');
		`);
		statements = [];
		const prepare = sqlite.prepare.bind(sqlite);
		vi.spyOn(sqlite, 'prepare').mockImplementation((query) => {
			const statement = prepare(query);
			statements.push(statement);
			return statement;
		});
		db = new Kysely<TestDatabase>({ dialect: createNodeSqliteDialect(sqlite) });
	});

	afterEach(async () => {
		await db.destroy();
		// An unstarted stream never initializes the dialect's driver.
		if (sqlite.isOpen) sqlite.close();
		vi.restoreAllMocks();
	});

	const expectFinalized = () => {
		expect(statements.length).toBeGreaterThan(0);
		for (const statement of statements) {
			expect(() => statement.all()).toThrow('statement has been finalized');
		}
	};

	it('returns bound rows as plain objects and finalizes the read statement', async () => {
		const rows = await db.selectFrom('items').selectAll().where('id', '=', 2).execute();
		expect(rows).toEqual([{ id: 2, value: 'second' }]);
		expect(Object.getPrototypeOf(rows[0])).toBe(Object.prototype);
		expectFinalized();
	});

	it('preserves write metadata and RETURNING rows while finalizing each statement', async () => {
		const insert = await db
			.insertInto('items')
			.values({ id: 4, value: 'fourth' })
			.executeTakeFirst();
		expect(insert.insertId).toBe(4n);
		expect(insert.numInsertedOrUpdatedRows).toBe(1n);
		expectFinalized();

		const rows = await db
			.updateTable('items')
			.set({ value: 'changed' })
			.where('id', '=', 4)
			.returningAll()
			.execute();
		expect(rows).toEqual([{ id: 4, value: 'changed' }]);
		expectFinalized();

		const result = await db.deleteFrom('items').where('id', '=', 4).executeTakeFirst();
		expect(result.numDeletedRows).toBe(1n);
		expectFinalized();
	});

	it('finalizes a failed write and leaves the connection usable', async () => {
		await expect(
			db.insertInto('items').values({ id: 4, value: 'first' }).execute()
		).rejects.toThrow('UNIQUE constraint failed');
		expectFinalized();
		expect(await db.selectFrom('items').selectAll().execute()).toHaveLength(3);
		expectFinalized();
	});

	it('finalizes a failed read without replacing its original error', async () => {
		const failure = new Error('read failed');
		sqlite.function('fail', () => {
			throw failure;
		});
		await expect(sql`SELECT fail()`.execute(db)).rejects.toBe(failure);
		expectFinalized();
	});

	it('finalizes a stream after exhaustion', async () => {
		const rows = [];
		for await (const row of db.selectFrom('items').selectAll().orderBy('id').stream()) {
			rows.push(row);
		}
		expect(rows.map((row) => row.id)).toEqual([1, 2, 3]);
		expectFinalized();
	});

	it('finalizes a stream when the consumer stops early', async () => {
		for await (const row of db.selectFrom('items').selectAll().orderBy('id').stream()) {
			expect(row.id).toBe(1);
			break;
		}
		expectFinalized();
		expect(await db.selectFrom('items').selectAll().execute()).toHaveLength(3);
	});

	it('finalizes a stream when its consumer throws', async () => {
		const failure = new Error('consumer failed');
		const consume = async () => {
			for await (const row of db.selectFrom('items').selectAll().orderBy('id').stream()) {
				expect(row.id).toBe(1);
				throw failure;
			}
		};
		await expect(consume()).rejects.toBe(failure);
		expectFinalized();
	});

	it('finalizes a stream when SQLite throws during iteration', async () => {
		const failure = new Error('iteration failed');
		let calls = 0;
		sqlite.function('read_value', (value) => {
			if (++calls === 2) throw failure;
			return value;
		});
		const values: unknown[] = [];
		const consume = async () => {
			for await (const row of db
				.selectFrom('items')
				.select(sql<string>`read_value(value)`.as('value'))
				.stream()) {
				values.push(row.value);
			}
		};
		await expect(consume()).rejects.toBe(failure);
		expect(values).toEqual(['first']);
		expectFinalized();
	});

	it('does not prepare a statement for an unstarted stream', async () => {
		const stream = db.selectFrom('items').selectAll().stream();
		await stream.return?.();
		expect(statements).toEqual([]);
	});

	it('finalizes a stream when its abort signal stops iteration', async () => {
		const controller = new AbortController();
		const failure = new DOMException('stream cancelled', 'AbortError');
		const ids: number[] = [];
		const consume = async () => {
			for await (const row of db
				.selectFrom('items')
				.selectAll()
				.stream({ signal: controller.signal })) {
				ids.push(row.id);
				controller.abort(failure);
			}
		};
		await expect(consume()).rejects.toBe(failure);
		expect(ids).toEqual([1]);
		expectFinalized();
	});
});
