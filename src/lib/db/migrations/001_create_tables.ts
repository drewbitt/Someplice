import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable('goals')
		.addColumn('id', 'integer', (col) => col.notNull().autoIncrement().primaryKey())
		// no boolean - 0 (false) or 1 (true)
		.addColumn('active', 'integer', (col) => col.notNull())
		.addColumn('orderNumber', 'integer', (col) => col.notNull())
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('color', 'text', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('intentions')
		.addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
		.addColumn('goalId', 'integer', (col) => col.references('goals.id'))
		.addColumn('completed', 'boolean')
		.addColumn('text', 'text', (col) => col.notNull())
		// optional column for sub intention of another intention
		.addColumn('parentIntentionId', 'integer', (col) => col.references('intentions.id'))
		// text like a, ab, abc, etc where it is the sub intention of a goal
		// e.g. 2a), 2b), 2c), etc
		.addColumn('subIntentionQualifier', 'text', (col) =>
			col.check(sql`length("subIntentionQualifier") < 3`)
		)
		.addColumn('date', 'date')
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('user').execute();
	await db.schema.dropTable('goal').execute();
}