import type { Kysely } from 'kysely';
import type { DB } from '../types/data';
import { getDb } from './db';
import { wallClockInZone } from '../utils';
import { dbLogger } from '../utils/logger';

/**
 * Link an intention to an outcome, ignoring an already-existing link.
 * @returns true when the link was inserted.
 */
export const linkIntentionToOutcome = async (
	db: Kysely<DB>,
	outcomeId: number,
	intentionId: number
): Promise<boolean> => {
	const rows = await db
		.insertInto('outcomes_intentions')
		.values({ outcomeId, intentionId })
		.onConflict((oc) => oc.doNothing())
		.returningAll()
		.execute();
	return rows.length > 0;
};

/**
 * Delete any of the given outcomes that no longer have intentions or verdicts linked.
 */
export const deleteOrphanedOutcomes = async (
	db: Kysely<DB>,
	outcomeIds: number[]
): Promise<void> => {
	const ids = [...new Set(outcomeIds)];
	// Keep bound parameters below SQLite's limit, including for large histories.
	const batchSize = 900;
	for (let offset = 0; offset < ids.length; offset += batchSize) {
		await db
			.deleteFrom('outcomes')
			.where('id', 'in', ids.slice(offset, offset + batchSize))
			.where(({ and, not, exists, selectFrom }) =>
				and([
					not(
						exists(
							selectFrom('outcomes_intentions')
								.select('outcomeId')
								.whereRef('outcomes_intentions.outcomeId', '=', 'outcomes.id')
						)
					),
					not(
						exists(
							selectFrom('outcome_verdicts')
								.select('outcomeId')
								.whereRef('outcome_verdicts.outcomeId', '=', 'outcomes.id')
						)
					)
				])
			)
			.execute();
	}
};

export const isValidTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
};

export const getSetting = async (db: Kysely<DB>, key: string): Promise<string | null> => {
	const row = await db
		.selectFrom('settings')
		.select('value')
		.where('key', '=', key)
		.executeTakeFirst();
	return row?.value ?? null;
};

export const setSetting = async (db: Kysely<DB>, key: string, value: string): Promise<void> => {
	await db
		.insertInto('settings')
		.values({ key, value })
		.onConflict((oc) => oc.column('key').doUpdateSet({ value }))
		.execute();
};

/** Write-once insert: keeps the existing row on conflict. */
export const setSettingIfAbsent = async (
	db: Kysely<DB>,
	key: string,
	value: string
): Promise<void> => {
	await db
		.insertInto('settings')
		.values({ key, value })
		.onConflict((oc) => oc.column('key').doNothing())
		.execute();
};

/**
 * The single timezone every day boundary uses, server and client alike:
 * the stored `timezone` setting (written once from the browser's
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`, changeable via the
 * settings API), then the `SOMEPLICE_TIMEZONE` env var for headless
 * operators, then UTC. `TZ` is deliberately NOT read — it is exactly the
 * server-vs-browser mismatch this setting replaces.
 */
export const getConfiguredTimeZone = async (db: Kysely<DB> = getDb()): Promise<string> => {
	const stored = await getSetting(db, 'timezone');
	if (stored !== null) {
		if (isValidTimeZone(stored)) return stored;
		dbLogger.error(`settings.timezone holds an invalid IANA zone: ${stored}; using UTC`);
		return 'UTC';
	}
	const envZone = process.env.SOMEPLICE_TIMEZONE;
	if (envZone && isValidTimeZone(envZone)) return envZone;
	if (envZone) dbLogger.error(`SOMEPLICE_TIMEZONE is not a valid IANA zone: ${envZone}; using UTC`);
	return 'UTC';
};

/** node:sqlite throws plain Errors for constraint violations — detect the unique kind. */
export const isUniqueViolation = (error: unknown): boolean =>
	error instanceof Error &&
	(error.message.includes('UNIQUE constraint failed') ||
		(error as { errcode?: number }).errcode === 2067);

/** Wall-clock "now" in the configured zone (fake-Z Date convention). */
export const configuredZoneNow = async (db: Kysely<DB> = getDb()): Promise<Date> =>
	wallClockInZone(await getConfiguredTimeZone(db));
