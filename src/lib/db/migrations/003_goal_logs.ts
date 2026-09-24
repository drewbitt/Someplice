import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('goal_logs')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('goalId', 'integer', (col) =>
			col.notNull().references('goals.id').onDelete('cascade')
		)
		.addColumn('orderNumber', 'integer')
		.addColumn('type', 'text', (col) =>
			col.notNull().check(sql`"type" IN ('start', 'end', 'reorder')`)
		)
		// ISO 8601 date string
		.addColumn('date', 'text', (col) =>
			col.notNull().check(sql`"date" = strftime('%Y-%m-%dT%H:%M:%fZ', "date")`)
		)
		.modifyEnd(sql`strict`)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('goal_logs').execute();
}
