import { Cron, scheduledJobs } from 'croner';
import { sql } from 'kysely';
import { getDb } from './db';
import { getConfiguredTimeZone } from './queries';
import { cronLogger } from '../utils/logger';
import { dateKeyInZone } from '../utils';

const jobName = 'outcomeCron';

export function stopCronJobs() {
	scheduledJobs.find((job) => job.name === jobName)?.stop();
}

export function createCronJobs() {
	// Avoid duplicate jobs after hot reload.
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

	// Backfill only past days; a stale link to another day does not count.
	const today = dateKeyInZone(await getConfiguredTimeZone(), now);
	await getDb()
		.transaction()
		.execute(async (db) => {
			const day = sql<string>`DATE("intentions"."date")`;
			await db
				.insertInto('outcomes')
				.columns(['date', 'reviewed'])
				.expression(
					db
						.selectFrom('intentions')
						.leftJoin('outcomes', (join) => join.onRef('outcomes.date', '=', day))
						.select([day.as('date'), sql.lit(0).as('reviewed')])
						.distinct()
						.where(day, '<', today)
						.where('outcomes.id', 'is', null)
				)
				.execute();

			const links = await db
				.insertInto('outcomes_intentions')
				.columns(['outcomeId', 'intentionId'])
				.expression(
					db
						.selectFrom('intentions')
						.innerJoin('outcomes', (join) => join.onRef('outcomes.date', '=', day))
						.leftJoin('outcomes_intentions as link', (join) =>
							join
								.onRef('link.outcomeId', '=', 'outcomes.id')
								.onRef('link.intentionId', '=', 'intentions.id')
						)
						.select((eb) => [
							eb.ref('outcomes.id').$notNull().as('outcomeId'),
							eb.ref('intentions.id').$notNull().as('intentionId')
						])
						.where(day, '<', today)
						.where('link.intentionId', 'is', null)
				)
				.executeTakeFirst();

			if (links.numInsertedOrUpdatedRows === 0n) {
				cronLogger.info('No missing outcome links');
			}
		});
}
