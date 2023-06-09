import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable('goals')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// 0 (false) or 1 (true)
		.addColumn('active', 'integer', (col) => col.notNull())
		.addColumn('orderNumber', 'integer', (col) => col.notNull())
		.addColumn('title', 'text', (col) => col.notNull())
		.addColumn('description', 'text')
		.addColumn('color', 'text', (col) => col.notNull())
		.execute();

	await sql`
		CREATE TRIGGER unique_orderNumber_for_active_goals
		BEFORE INSERT ON goals
		FOR EACH ROW
		WHEN EXISTS (
			SELECT 1 
			FROM goals 
			WHERE orderNumber = NEW.orderNumber 
			  AND active = 1
		)
		BEGIN
			SELECT RAISE(FAIL, "Another active goal with the same orderNumber exists.");
		END;
	`.execute(db);

	await db.schema
		.createTable('intentions')
		// autoIncrement after the primaryKey prevents reuse of the id after deletion
		.addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
		// .addColumn('goalId', 'integer', (col) => col.notNull())
		.addColumn('orderNumber', 'integer', (col) => col.notNull())
		// 0 (false) or 1 (true)
		.addColumn('completed', 'integer', (col) => col.notNull())
		.addColumn('text', 'text', (col) => col.notNull())
		// text like a, A, ab, abc, etc where it is the sub intention of a goal e.g. 2a), 2b), 2abc)
		.addColumn('subIntentionQualifier', 'text', (col) =>
			col.check(sql`"subIntentionQualifier" REGEXP '[a-z]{0,3}'`)
		)
		// ISO 8601 date string
		.addColumn('date', 'text', (col) =>
			col.notNull().check(sql`"date" = strftime('%Y-%m-%dT%H:%M:%fZ', "date")`)
		)
		.execute();

	// Kysely doesn't support deferrable foreign keys yet so we have to use raw sql
	await sql`ALTER TABLE intentions ADD COLUMN goalId INTEGER REFERENCES goals(id) NOT NULL DEFERRABLE INITIALLY DEFERRED;`.execute(
		db
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('user').execute();
	await db.schema.dropTable('goal').execute();
}
