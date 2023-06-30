import { Cron } from 'croner';
import type { ValueExpression } from 'kysely';
import type { DB } from '../types/data';
import { logger } from '../utils/logger';
import { db } from './db';

// Run functions at the interval defined by a cron expression
// This seperates the creation of the cron jobs into a module
export function createCronJobs() {
	// Run at 00:00 every day
	const outcomeCron = Cron('0 0 * * *', async () => {
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
		for (let intention of intentions) {
			await db.transaction().execute(async (db) => {
				logger.info(`Checking for outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids

				// Check if the pair already exists in the table
				const existingPair = await db
					.selectFrom('outcomes_intentions')
					.selectAll()
					.where('outcomeId', '=', outcomeId)
					.where('intentionId', '=', intention.id)
					.execute();

				// If the pair does not exist, insert it
				if (existingPair.length === 0) {
					logger.info(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
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
	logger.info('Checking for missing outcomes from past days when the application is restarted');
	const intentions = await db.selectFrom('intentions').selectAll().execute();

	for (let intention of intentions) {
		const outcomes = await db
			.selectFrom('outcomes')
			.selectAll()
			.where('date', '=', intention.date.slice(0, 10))
			.execute();

		let outcomeId: number | null = outcomes.length ? outcomes[0].id : null;

		if (!outcomeId) {
			// if there's no outcome for the intention's date, create one and associate it with the intention
			logger.debug(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
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
				logger.debug(`Inserting outcomeId: ${outcomeId}, intentionId: ${intention.id}`); // Log the ids
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
	logger.info(
		'Finished checking for missing outcomes from past days when the application is restarted'
	);
}
