import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable('intentions')
		.addColumn('status', 'text', (col) =>
			col
				.notNull()
				.defaultTo('pending')
				.check(sql`"status" IN ('pending', 'done', 'not_today')`)
		)
		.execute();

	await sql`
		UPDATE "intentions"
		SET "status" = CASE WHEN "completed" = 1 THEN 'done' ELSE 'pending' END
	`.execute(db);

	await db.schema.alterTable('intentions').dropColumn('completed').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable('intentions')
		.addColumn('completed', 'integer', (col) =>
			col
				.notNull()
				.defaultTo(0)
				.check(sql`"completed" IN (0, 1)`)
		)
		.execute();

	await sql`
		UPDATE "intentions"
		SET "completed" = CASE WHEN "status" = 'done' THEN 1 ELSE 0 END
	`.execute(db);

	await db.schema.alterTable('intentions').dropColumn('status').execute();
}
