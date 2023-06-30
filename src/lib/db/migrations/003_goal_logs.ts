import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('goal_logs')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('goalId', 'integer', (col) => col.notNull().references('goals.id'))
		// ISO 8601 date string
		.addColumn('startDate', 'text', (col) =>
			col.notNull().check(sql`"startDate" = strftime('%Y-%m-%dT%H:%M:%fZ', "startDate")`)
		)
		// ISO 8601 date string
		.addColumn('endDate', 'text', (col) =>
			col.check(sql`"endDate" = strftime('%Y-%m-%dT%H:%M:%fZ', "endDate")`)
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('goal_logs').execute();
}
