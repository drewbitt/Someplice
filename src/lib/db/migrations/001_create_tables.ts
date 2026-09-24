import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('goals')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// 0 (false) or 1 (true)
		.addColumn('active', 'integer', (col) => col.notNull().check(sql`"active" IN (0, 1)`))
		.addColumn('orderNumber', 'integer', (col) => col.notNull().check(sql`"orderNumber" >= 0`))
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('color', 'text', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('intentions')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('goalId', 'integer', (col) => col.notNull())
		.addColumn('orderNumber', 'integer', (col) => col.notNull().check(sql`"orderNumber" >= 0`))
		// 0 (false) or 1 (true)
		.addColumn('completed', 'integer', (col) => col.notNull().check(sql`"completed" IN (0, 1)`))
		.addColumn('text', 'text', (col) => col.notNull())
		// lowercase letters like a, ab, abc - the sub intention of a goal e.g. 2a), 2b), 2abc)
		.addColumn('subIntentionQualifier', 'text', (col) =>
			col.check(sql`"subIntentionQualifier" REGEXP '[a-z]{0,3}'`)
		)
		// ISO 8601 date string
		.addColumn('date', 'text', (col) =>
			col.notNull().check(sql`"date" = strftime('%Y-%m-%dT%H:%M:%fZ', "date")`)
		)
		.addForeignKeyConstraint('intentions_goalId_fk', ['goalId'], 'goals', ['id'], (fk) =>
			fk.deferrable().initiallyDeferred()
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('intentions').execute();
	await db.schema.dropTable('goals').execute();
}
