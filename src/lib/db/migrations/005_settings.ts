import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Installation-level key/value settings. The first key is 'timezone': the
	// IANA zone all day-boundary math runs in (server "today"/"yesterday" and
	// the zone the client renders days in), auto-detected from the browser on
	// first load and changeable via the settings API.
	await db.schema
		.createTable('settings')
		.addColumn('key', 'text', (col) => col.primaryKey())
		.addColumn('value', 'text', (col) => col.notNull())
		.modifyEnd(sql`strict`)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable('settings').execute();
}
