import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.createIndex('idx_intentions_goalId').on('intentions').column('goalId').execute();
	await db.schema.createIndex('idx_intentions_date').on('intentions').column('date').execute();
	await db.schema
		.createIndex('idx_goal_logs_goalId_date')
		.on('goal_logs')
		.columns(['goalId', 'date'])
		.execute();
	await db.schema
		.createIndex('idx_outcomes_intentions_intentionId')
		.on('outcomes_intentions')
		.column('intentionId')
		.execute();
	// Partial unique index: orderNumber must be unique among *active* goals. Unlike the
	// previous BEFORE INSERT trigger, this also rejects duplicates created via UPDATE.
	await sql`
		CREATE UNIQUE INDEX uq_goals_active_orderNumber
		ON goals (orderNumber) WHERE active = 1
	`.execute(db);
	// One slot per orderNumber per day: guards against duplicate intentions from
	// repeated saves of the same parsed editor text.
	await sql`
		CREATE UNIQUE INDEX uq_intentions_date_orderNumber
		ON intentions (DATE(date), orderNumber)
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex('uq_intentions_date_orderNumber').execute();
	await db.schema.dropIndex('uq_goals_active_orderNumber').execute();
	await db.schema.dropIndex('idx_outcomes_intentions_intentionId').execute();
	await db.schema.dropIndex('idx_goal_logs_goalId_date').execute();
	await db.schema.dropIndex('idx_intentions_date').execute();
	await db.schema.dropIndex('idx_intentions_goalId').execute();
}
