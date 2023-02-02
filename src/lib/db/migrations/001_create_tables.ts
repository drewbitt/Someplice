import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('goals')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// 0 (false) or 1 (true)
		.addColumn('active', 'integer', (col) => col.notNull())
		.addColumn('orderNumber', 'integer', (col) => col.notNull().unique())
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('color', 'text', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('intentions')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('goalId', 'integer', (col) => col.references('goals.id').notNull())
		// 0 (false) or 1 (true)
		.addColumn('completed', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		// optional column for sub intention of another intention
		.addColumn('parentIntentionId', 'integer', (col) => col.references('intentions.id').notNull())
		// text like a, ab, abc, etc where it is the sub intention of a goal e.g. 2a), 2b), 2abc)
		.addColumn('subIntentionQualifier', 'text', (col) =>
			col
				.notNull()
				.check(sql`length("subIntentionQualifier") < 3`)
				.check(sql`"subIntentionQualifier" GLOB '[0-9]*[a-z]'`)
		)
		// TEXT as ISO8601 strings ("YYYY-MM-DD HH:MM:SS.SSS")
		.addColumn('date', 'text', (col) =>
			col.notNull().check(sql`"date" GLOB '[0-9]{4}-[0-9]{2}-[0-9]{2}*'`)
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('user').execute();
	await db.schema.dropTable('goal').execute();
}
