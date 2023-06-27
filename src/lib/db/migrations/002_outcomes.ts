import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('outcomes')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// 0 (false) or 1 (true)
		.addColumn('reviewed', 'integer', (col) => col.notNull())
		// ISO 8601 date string but without the time
		.addColumn('date', 'text', (col) =>
			col
				.notNull()
				.check(sql`"date" = strftime('%Y-%m-%d', "date")`)
				.unique()
		)
		.execute();

	await db.schema
		.createTable('outcomes_intentions')
		.addColumn('outcomeId', 'integer', (col) => col.notNull().references('outcomes.id'))
		.addColumn('intentionId', 'integer', (col) => col.notNull().references('intentions.id'))
		.addPrimaryKeyConstraint('outcomes_intentions_pk', ['outcomeId', 'intentionId'])
		.execute();
}
