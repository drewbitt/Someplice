import { Cron, scheduledJobs } from 'croner';
import type { ValueExpression } from 'kysely';
import type { DB } from '../types/data';
import { DbInstance } from './db';
import { cronLogger } from '../utils/logger';

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
		const today = new Date().toISOString().slice(0, 10); // get today's date in YYYY-MM-DD format

		// check if there's an outcome for today
		const outcomes = await db
			.selectFrom('outcomes')
			.selectAll()
			.where('date', '=', today)
			.execute();

		let outcomeId: number | null = outcomes.length ? outcomes[0].id : null;

		if (!outcomeId) {
			// if there's no outcome for today, create one
			const newOutcome = await db.transaction().execute(async (db) => {
				return await db
					.insertInto('outcomes')
					.values({ reviewed: 0, date: today })
					.returning('id')
					.execute();
			});
			outcomeId = newOutcome[0].id;
		}

		// get today's intentions
		const intentions = await db
			.selectFrom('intentions')
			.selectAll()
			.where('date', '>=', today)
			.where('date', '<', today + 'T23:59:59.999Z')
			.execute();

		// associate the intentions with the outcome
		for (const intention of intentions) {
			await db.transaction().execute(async (db) => {
				cronLogger.debug(`Checking for outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids

				// Check if the pair already exists in the table
				const existingPair = await db
					.selectFrom('outcomes_intentions')
					.selectAll()
					.where('outcomeId', '=', outcomeId)
					.where('intentionId', '=', intention.id)
					.execute();

				// If the pair does not exist, insert it
				if (existingPair.length === 0) {
					cronLogger.debug(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
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

	cronLogger.info('Checking for missing outcomes from past days when the application is restarted');
	const intentions = await db.selectFrom('intentions').selectAll().execute();

	for (const intention of intentions) {
		const outcomes = await db
			.selectFrom('outcomes')
			.selectAll()
			.where('date', '=', intention.date.slice(0, 10))
			.execute();

		let outcomeId: number | null = outcomes.length ? outcomes[0].id : null;

		if (outcomeId === null) {
			// if there's no outcome for the intention's date, create one and associate it with the intention
			cronLogger.debug(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
			await db.transaction().execute(async (db) => {
				const newOutcome = await db
					.insertInto('outcomes')
					.values({ reviewed: 0, date: intention.date.slice(0, 10) })
					.returning('id')
					.execute();
				outcomeId = newOutcome[0].id;
			});
		}

		await db.transaction().execute(async (db) => {
			// Check if the pair already exists in the table
			const existingPair = await db
				.selectFrom('outcomes_intentions')
				.selectAll()
				.where('outcomeId', '=', outcomeId)
				.where('intentionId', '=', intention.id)
				.execute();

			// If the pair does not exist, insert it
			if (existingPair.length === 0) {
				cronLogger.debug(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
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
}
