import type { Kysely } from 'kysely';
import type { DB } from '../types/data';
import { getDb } from './db';
import { wallClockInZone } from '../utils';
import { dbLogger } from '../utils/logger';

/**
 * Return the id of the outcome for a date (`YYYY-MM-DD`), creating it
 * (unreviewed) when it does not exist yet.
 * @returns the outcome id, or null if the row could not be created.
 */
export const ensureOutcomeForDate = async (
	db: Kysely<DB>,
	date: string
): Promise<number | null> => {
	// INSERT-or-ignore then SELECT: a read-then-insert races with a concurrent
	// caller and one of them dies on the outcomes.date UNIQUE constraint.
	await db
		.insertInto('outcomes')
		.values({ reviewed: 0, date })
		.onConflict((oc) => oc.column('date').doNothing())
		.execute();
	const outcome = await db
		.selectFrom('outcomes')
		.select('id')
		.where('date', '=', date)
		.executeTakeFirst();
	return outcome?.id ?? null;
};

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
	for (const outcomeId of new Set(outcomeIds)) {
		const remaining = await db
			.selectFrom('outcomes_intentions')
			.select(({ fn }) => [fn.countAll<number>().as('count')])
			.where('outcomeId', '=', outcomeId)
			.executeTakeFirstOrThrow();
		const verdicts = await db
			.selectFrom('outcome_verdicts')
			.select(({ fn }) => [fn.countAll<number>().as('count')])
			.where('outcomeId', '=', outcomeId)
			.executeTakeFirstOrThrow();
		if (Number(remaining.count) === 0 && Number(verdicts.count) === 0) {
			await db.deleteFrom('outcomes').where('id', '=', outcomeId).execute();
		}
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

/** Wall-clock "now" in the configured zone (fake-Z Date convention). */
export const configuredZoneNow = async (db: Kysely<DB> = getDb()): Promise<Date> =>
	wallClockInZone(await getConfiguredTimeZone(db));
