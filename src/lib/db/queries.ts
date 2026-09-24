import type { Kysely } from 'kysely';
import type { DB } from '../types/data';

/**
 * Return the id of the outcome for a date (`YYYY-MM-DD`), creating it
 * (unreviewed) when it does not exist yet.
 * @returns the outcome id, or null if the row could not be created.
 */
export const ensureOutcomeForDate = async (
	db: Kysely<DB>,
	date: string
): Promise<number | null> => {
	const existing = await db
		.selectFrom('outcomes')
		.select('id')
		.where('date', '=', date)
		.executeTakeFirst();
	if (existing) {
		return existing.id;
	}
	const created = await db
		.insertInto('outcomes')
		.values({ reviewed: 0, date })
		.returning('id')
		.executeTakeFirst();
	return created?.id ?? null;
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
 * Delete any of the given outcomes that no longer have intentions linked.
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
		if (Number(remaining.count) === 0) {
			await db.deleteFrom('outcomes').where('id', '=', outcomeId).execute();
		}
	}
};
