import { Cron, scheduledJobs } from 'croner';
import { sql } from 'kysely';
import { DbInstance } from './db';
import { ensureOutcomeForDate, linkIntentionToOutcome } from './queries';
import { cronLogger } from '../utils/logger';
import { localeCurrentDate, localePreviousDate } from '../utils';

const jobName = 'outcomeCron';

// DbInstance must not be constructed at module import: hooks.server.ts is imported
// during `vite build`, where the database does not exist yet.
const getDb = () => DbInstance.getInstance().db;

// Run functions at the interval defined by a cron expression
// This seperates the creation of the cron jobs into a module
export function createCronJobs() {
	// Don't create the cron job if it already exists, which happens in dev mode upon hot reload
	const existingJob = scheduledJobs.find((j) => j.name === jobName);
	if (existingJob) {
		return;
	}

	// Run at 00:00 every day. The Cron constructor self-registers in scheduledJobs.
	new Cron('0 0 * * *', { name: jobName }, async () => {
		await getDb()
			.transaction()
			.execute(async (db) => {
				const previousDayString = localePreviousDate().toISOString().slice(0, 10);

				// select the previous day's intentions first: a day without intentions
				// gets no outcome row at all
				const intentions = await db
					.selectFrom('intentions')
					.selectAll()
					.where('date', '>=', `${previousDayString}T00:00:00.000Z`)
					.where('date', '<=', `${previousDayString}T23:59:59.999Z`)
					.execute();

				if (intentions.length === 0) {
					cronLogger.debug(
						`outcomeCron: No intentions for date: ${previousDayString}, skipping outcome creation`
					);
					return;
				}

				const outcomeId = await ensureOutcomeForDate(db, previousDayString);
				if (outcomeId === null) {
					cronLogger.error(`outcomeCron: Could not create outcome for date: ${previousDayString}`);
					return;
				}

				for (const intention of intentions) {
					if (intention.id === null) {
						continue;
					}
					const linked = await linkIntentionToOutcome(db, outcomeId, intention.id);
					cronLogger.debug(
						`outcomeCron: outcomeId: ${outcomeId}, intentionId: ${intention.id} ` +
							(linked
								? `inserted into outcomes_intentions`
								: `already exists in outcomes_intentions`)
					);
				}
			});
	});
}

export async function checkMissingOutcomes() {
	cronLogger.info(
		'checkMissingOutcomes: Checking for missing outcomes from past days when the application is restarted'
	);

	// Only past days get outcomes backfilled: today's intentions get theirs from
	// the midnight job. An intention with no outcomes_intentions link is by
	// definition missing its outcome's association.
	const today = localeCurrentDate().toISOString().slice(0, 10);
	const intentions = await getDb()
		.selectFrom('intentions')
		.selectAll()
		.where(sql`DATE("date")`, '<', today)
		.where(({ not, exists, selectFrom }) =>
			not(
				exists(
					selectFrom('outcomes_intentions')
						.select('outcomes_intentions.intentionId')
						.whereRef('outcomes_intentions.intentionId', '=', 'intentions.id')
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
