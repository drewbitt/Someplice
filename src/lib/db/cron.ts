import { Cron, scheduledJobs } from 'croner';
import { sql } from 'kysely';
import { getDb } from './db';
import { ensureOutcomeForDate, getConfiguredTimeZone, linkIntentionToOutcome } from './queries';
import { cronLogger } from '../utils/logger';
import { dateKeyInZone } from '../utils';

const jobName = 'outcomeCron';

export function stopCronJobs() {
	scheduledJobs.find((job) => job.name === jobName)?.stop();
}

export function createCronJobs() {
	// Don't create the cron job if it already exists, which happens in dev mode upon hot reload
	const existingJob = scheduledJobs.find((j) => j.name === jobName);
	if (existingJob) {
		return;
	}

	// Retry past-day repairs hourly; the installation zone owns day boundaries.
	new Cron(
		'0 * * * *',
		{ name: jobName, catch: (error) => cronLogger.error('outcomeCron: job failed', error) },
		async () => {
			await checkMissingOutcomes();
		}
	);
	process.once('sveltekit:shutdown', stopCronJobs);
}

export async function checkMissingOutcomes(now: Date = new Date()) {
	cronLogger.info('Checking for missing past-day outcomes');

	// Only past days get outcomes backfilled: today's intentions get theirs once
	// their day ends. An intention counts as missing unless it is linked to an
	// outcome for its OWN day — a stale link to another day's outcome (e.g. left
	// behind by a cross-date move) must not exempt it.
	const today = dateKeyInZone(await getConfiguredTimeZone(), now);
	await getDb()
		.transaction()
		.execute(async (db) => {
			const intentions = await db
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
			}

			if (!actionTaken) {
				cronLogger.info('No missing outcome links');
			}
		});
}
