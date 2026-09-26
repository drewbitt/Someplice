import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('priorities')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('goalId', 'integer', (col) =>
			col.notNull().references('goals.id').onDelete('cascade')
		)
		.addColumn('text', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		// YYYY-MM-DD check-in date, optional
		.addColumn('checkInDate', 'text', (col) =>
			col.check(sql`"checkInDate" IS NULL OR "checkInDate" = strftime('%Y-%m-%d', "checkInDate")`)
		)
		// ISO 8601 date string
		.addColumn('createdAt', 'text', (col) =>
			col.notNull().check(sql`"createdAt" = strftime('%Y-%m-%dT%H:%M:%fZ', "createdAt")`)
		)
		// ISO 8601 date string; NULL = the priority is still active
		.addColumn('completedAt', 'text', (col) =>
			col.check(
				sql`"completedAt" IS NULL OR "completedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', "completedAt")`
			)
		)
		// filled at completion, optional
		.addColumn('reflection', 'text')
		.modifyEnd(sql`strict`)
		.execute();

	// Partial unique index: at most one active (completedAt IS NULL) priority per goal,
	// matching uq_goals_active_orderNumber in 004_indexes.
	await sql`
		CREATE UNIQUE INDEX uq_priorities_active_goalId
		ON priorities (goalId) WHERE completedAt IS NULL
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex('uq_priorities_active_goalId').execute();
	await db.schema.dropTable('priorities').execute();
}
