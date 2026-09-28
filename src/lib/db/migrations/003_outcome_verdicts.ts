import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('outcome_verdicts')
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		.addColumn('outcomeId', 'integer', (col) =>
			col.notNull().references('outcomes.id').onDelete('cascade')
		)
		.addColumn('goalId', 'integer', (col) =>
			col.notNull().references('goals.id').onDelete('cascade')
		)
		.addColumn('verdict', 'text', (col) =>
			col.notNull().check(sql`"verdict" IN ('enough', 'not_enough', 'day_off')`)
		)
		// optional "say more" text from the verdict row
		.addColumn('note', 'text')
		.modifyEnd(sql`strict`)
		.execute();

	// one verdict per goal per outcome
	await sql`
		CREATE UNIQUE INDEX uq_outcome_verdicts_outcomeId_goalId
		ON outcome_verdicts (outcomeId, goalId)
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('outcome_verdicts').execute();
}
