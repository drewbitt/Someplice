import { type Kysely } from 'kysely';

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
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex('idx_outcomes_intentions_intentionId').execute();
	await db.schema.dropIndex('idx_goal_logs_goalId_date').execute();
	await db.schema.dropIndex('idx_intentions_date').execute();
	await db.schema.dropIndex('idx_intentions_goalId').execute();
}
