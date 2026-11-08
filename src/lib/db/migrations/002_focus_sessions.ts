import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('focus_sessions')
		.addColumn('id', 'text', (c) => c.primaryKey())
		.addColumn('kind', 'text', (c) =>
			c.notNull().check(sql`kind IN ('pomodoro', 'hourglass', 'break')`)
		)
		.addColumn('status', 'text', (c) =>
			c.notNull().check(sql`status IN ('running', 'paused', 'completed', 'cancelled')`)
		)
		.addColumn('day', 'text', (c) => c.notNull())
		.addColumn('intentionId', 'integer', (c) => c.references('intentions.id').onDelete('set null'))
		.addColumn('intentionText', 'text')
		.addColumn('plannedSeconds', 'integer', (c) =>
			c.notNull().check(sql`plannedSeconds BETWEEN 60 AND 10800`)
		)
		.addColumn('elapsedSeconds', 'integer', (c) =>
			c
				.notNull()
				.defaultTo(0)
				.check(sql`elapsedSeconds >= 0 AND elapsedSeconds <= plannedSeconds`)
		)
		.addColumn('startedAt', 'integer', (c) => c.notNull())
		.addColumn('lastStartedAt', 'integer')
		.addColumn('endedAt', 'integer')
		.addColumn('revision', 'integer', (c) => c.notNull().defaultTo(0))
		.addCheckConstraint(
			'focus_session_state',
			sql`(status = 'running' AND lastStartedAt IS NOT NULL AND endedAt IS NULL) OR (status = 'paused' AND kind = 'hourglass' AND lastStartedAt IS NULL AND endedAt IS NULL) OR (status IN ('completed', 'cancelled') AND lastStartedAt IS NULL AND endedAt IS NOT NULL)`
		)
		.modifyEnd(sql`strict`)
		.execute();
	await sql`CREATE UNIQUE INDEX uq_focus_sessions_active ON focus_sessions ((1)) WHERE status IN ('running', 'paused')`.execute(
		db
	);
	await db.schema
		.createIndex('idx_focus_sessions_day')
		.on('focus_sessions')
		.columns(['day', 'startedAt'])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('focus_sessions').execute();
}
