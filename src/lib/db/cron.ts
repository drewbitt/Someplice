import { Cron, scheduledJobs } from 'croner';
import type { ValueExpression } from 'kysely';
import type { DB } from '../types/data';
import { DbInstance } from './db';
import { cronLogger } from '../utils/logger';
import { localePreviousDate } from '../utils';

const db = DbInstance.getInstance().db;
const jobName = 'outcomeCron';

// Run functions at the interval defined by a cron expression
// This seperates the creation of the cron jobs into a module
export function createCronJobs() {
	// Don't create the cron job if it already exists, which happens in dev mode upon hot reload
	const existingJob = scheduledJobs.find((j) => j.name === jobName);
	if (existingJob) {
		return;
	}

	// Run at 00:00 every day
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const outcomeCron = Cron('0 0 * * *', { name: jobName }, async () => {
		await db.transaction().execute(async (db) => {
			const previousDay = localePreviousDate();
			const previousDayString = previousDay.toISOString().slice(0, 10);
			const startOfPreviousDay = previousDayString + 'T00:00:00.000Z';
			const endOfPreviousDay = previousDayString + 'T23:59:59.999Z';

			// check if there's an outcome for today
			const outcomes = await db
				.selectFrom('outcomes')
				.selectAll()
				.where('date', '=', previousDayString)
				.execute();

			let outcomeId: number | null = outcomes.length ? outcomes[0].id : null;

			if (!outcomeId) {
				// if there's no outcome for today, create one
				try {
					cronLogger.debug(`outcomeCron: Creating outcome for date: ${previousDayString}`);
					const newOutcome = await db
						.insertInto('outcomes')
						.values({ reviewed: 0, date: previousDayString })
						.returning('id')
						.executeTakeFirstOrThrow();
					outcomeId = newOutcome.id;
				} catch (e) {
					cronLogger.error(`outcomeCron: Could not create outcome for date: ${previousDayString}`);
					return;
				}
			}

			// get today's intentions
			const intentions = await db
				.selectFrom('intentions')
				.selectAll()
				.where('date', '>=', startOfPreviousDay)
				.where('date', '<=', endOfPreviousDay)
				.execute();

			// associate the intentions with the outcome
			for (const intention of intentions) {
				// Check if the pair already exists in the table
				const existingPair = await db
					.selectFrom('outcomes_intentions')
					.selectAll()
					.where('outcomeId', '=', outcomeId)
					.where('intentionId', '=', intention.id)
					.execute();

				// If the pair does not exist, insert it
				if (existingPair.length === 0) {
					cronLogger.debug(
						`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id} into outcomes_intentions`
					); // Log the ids
					await db
						.insertInto('outcomes_intentions')
						.values({
							outcomeId: outcomeId as ValueExpression<DB, 'outcomes_intentions', number>,
							intentionId: intention.id as ValueExpression<DB, 'outcomes_intentions', number>
						})
						.execute();
				} else {
					cronLogger.debug(
						`outcomeCron: outcomeId: ${outcomeId}, intentionId: ${intention.id} already exists in outcomes_intentions`
					);
				}
			}
		});
	});
}

export async function checkMissingOutcomes() {
	// Hooks.server.ts is run every time the application is restarted and does not preserve state.
	// So, a hack is needed to check for missing outcomes from past days when the application is restarted.
	// We can look if the cron, which is also started in hooks.server.ts, has already been established.
	// This requires checkMissingOutcomes to be called first in hooks.server.ts, so it runs at least once before createCronJobs.
	const existingJob = scheduledJobs.find((j) => j.name === jobName);
	if (existingJob) {
		return;
	}

	cronLogger.info(
		'checkMissingOutcomes: Checking for missing outcomes from past days when the application is restarted'
	);
	let actionTaken = false;
	const intentions = await db.selectFrom('intentions').selectAll().execute();

	for (const intention of intentions) {
		await db.transaction().execute(async (db) => {
			let outcomeId: number | null = null;

			const outcomes = await db
				.selectFrom('outcomes')
				.select(['id'])
				.where('date', '=', intention.date.slice(0, 10))
				.executeTakeFirst();

			if (outcomes) {
				outcomeId = outcomes.id;
			}

			if (outcomeId === null) {
				cronLogger.debug(
					`checkMissingOutcomes: Outcome does not exist. Creating outcome for date: ${intention.date.slice(
						0,
						10
					)}, intentionId: ${intention.id}`
				);
				actionTaken = true;
				const newOutcome = await db
					.insertInto('outcomes')
					.values({ reviewed: 0, date: intention.date.slice(0, 10) })
					.returning('id')
					.executeTakeFirst();

				if (newOutcome === undefined) {
					cronLogger.error('Could not create outcome');
					return;
				}
				outcomeId = newOutcome.id;
			}

			// Check if the pair already exists in the table
			const existingPair = await db
				.selectFrom('outcomes_intentions')
				.selectAll()
				.where('outcomeId', '=', outcomeId)
				.where('intentionId', '=', intention.id)
				.execute();

			// If the pair does not exist, insert it
			if (existingPair.length === 0 && outcomeId !== null && intention.id !== null) {
				cronLogger.debug(
					`checkMissingOutcomes: Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id} into outcomes_intentions`
				);
				actionTaken = true;
				await db
					.insertInto('outcomes_intentions')
					.values({
						outcomeId: outcomeId as ValueExpression<DB, 'outcomes_intentions', number>,
						intentionId: intention.id as ValueExpression<DB, 'outcomes_intentions', number>
					})
					.execute();
			}
		});
	}

	if (!actionTaken) {
		cronLogger.info('checkMissingOutcomes: No action was taken during the entire execution.');
	}
}
