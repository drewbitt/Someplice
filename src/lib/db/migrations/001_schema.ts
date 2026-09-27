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
		.modifyEnd(sql`strict`)
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
			col.check(sql`"subIntentionQualifier" REGEXP '^[a-z]{0,3}$'`)
		)
		// ISO 8601 date string
		.addColumn('date', 'text', (col) =>
			col.notNull().check(sql`"date" = strftime('%Y-%m-%dT%H:%M:%fZ', "date")`)
		)
		.addForeignKeyConstraint('intentions_goalId_fk', ['goalId'], 'goals', ['id'], (fk) =>
			fk.deferrable().initiallyDeferred().onDelete('cascade')
		)
		.modifyEnd(sql`strict`)
		.execute();

	await db.schema
		.createTable('outcomes')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// 0 (false) or 1 (true)
		.addColumn('reviewed', 'integer', (col) => col.notNull().check(sql`"reviewed" IN (0, 1)`))
		// ISO 8601 date string but without the time
		.addColumn('date', 'text', (col) =>
			col
				.notNull()
				.check(sql`"date" = strftime('%Y-%m-%d', "date")`)
				.unique()
		)
		.modifyEnd(sql`strict`)
		.execute();

	await db.schema
		.createTable('outcomes_intentions')
		.addColumn('outcomeId', 'integer', (col) =>
			col.notNull().references('outcomes.id').onDelete('cascade')
		)
		.addColumn('intentionId', 'integer', (col) =>
			col.notNull().references('intentions.id').onDelete('cascade')
		)
		.addPrimaryKeyConstraint('outcomes_intentions_pk', ['outcomeId', 'intentionId'])
		.modifyEnd(sql`strict`)
		.execute();

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
	await db.schema.dropTable('outcomes_intentions').execute();
	await db.schema.dropTable('outcomes').execute();
	await db.schema.dropTable('goal_logs').execute();
	await db.schema.dropTable('intentions').execute();
	await db.schema.dropTable('goals').execute();
}
