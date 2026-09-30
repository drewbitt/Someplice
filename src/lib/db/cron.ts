import { Cron, scheduledJobs } from 'croner';
import { sql } from 'kysely';
import { getDb } from './db';
import { ensureOutcomeForDate, getConfiguredTimeZone, linkIntentionToOutcome } from './queries';
import { cronLogger } from '../utils/logger';
import { dateKeyInZone } from '../utils';

const jobName = 'outcomeCron';

// Run functions at the interval defined by a cron expression
// This seperates the creation of the cron jobs into a module
export function createCronJobs() {
	// Don't create the cron job if it already exists, which happens in dev mode upon hot reload
	const existingJob = scheduledJobs.find((j) => j.name === jobName);
	if (existingJob) {
		return;
	}

	// Hourly. The day boundary lives in the configured timezone, not the
	// server's, so a fixed-midnight tick can't line up with every user's 00:00 —
	// instead each tick runs the same repair pass as startup: every past day
	// with unlinked intentions gets its outcome, meaning the day rollover lands
	// within an hour of the zone's midnight and a failed tick is retried by the
	// next one. `catch` keeps a transient failure (e.g. SQLITE_BUSY) from
	// becoming an unhandled rejection that exits the process.
	new Cron(
		'0 * * * *',
		{ name: jobName, catch: (error) => cronLogger.error('outcomeCron: job failed', error) },
		async () => {
			await checkMissingOutcomes();
		}
	);
}

export async function checkMissingOutcomes(now: Date = new Date()) {
	cronLogger.info(
		'checkMissingOutcomes: Checking for missing outcomes from past days when the application is restarted'
	);

	// Only past days get outcomes backfilled: today's intentions get theirs once
	// their day ends. An intention counts as missing unless it is linked to an
	// outcome for its OWN day — a stale link to another day's outcome (e.g. left
	// behind by a cross-date move) must not exempt it.
	const today = dateKeyInZone(await getConfiguredTimeZone(), now);
	const intentions = await getDb()
		.selectFrom('intentions')
		.selectAll()
		.where(sql`DATE("date")`, '<', today)
		.where(({ not, exists, selectFrom }) =>
			not(
				exists(
					selectFrom('outcomes_intentions')
						.innerJoin('outcomes', 'outcomes.id', 'outcomes_intentions.outcomeId')
						.select('outcomes_intentions.intentionId')
						.whereRef('outcomes_intentions.intentionId', '=', 'intentions.id')
						.where(({ eb }) =>
							eb(sql`DATE("outcomes"."date")`, '=', sql`DATE("intentions"."date")`)
						)
				)
			)
		)
		.execute();

	// Group intentions by day so each date's outcome is ensured and linked once
	const intentionsByDate = new Map<string, typeof intentions>();
	for (const intention of intentions) {
		const date = intention.date.slice(0, 10);
		const sameDate = intentionsByDate.get(date) ?? [];
		sameDate.push(intention);
		intentionsByDate.set(date, sameDate);
	}

	let actionTaken = false;
	for (const [date, dateIntentions] of intentionsByDate) {
		await getDb()
			.transaction()
			.execute(async (db) => {
				const outcomeId = await ensureOutcomeForDate(db, date);
				if (outcomeId === null) {
					cronLogger.error(`checkMissingOutcomes: Could not create outcome for date: ${date}`);
					return;
				}

				for (const intention of dateIntentions) {
					if (intention.id === null) {
						continue;
					}
					if (await linkIntentionToOutcome(db, outcomeId, intention.id)) {
						actionTaken = true;
					}
				}
			});
	}

	if (!actionTaken) {
		cronLogger.info('checkMissingOutcomes: No action was taken during the entire execution.');
	}
}
