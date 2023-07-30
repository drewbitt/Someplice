import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { z } from 'zod';

const getDb = () => DbInstance.getInstance().db;

export const GoalLogSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	type: z.string(),
	date: z.string()
});

export const goal_logs = t.router({
	/**
	 * Create a new goal log
	 * @param {GoalLogSchema} input - The goal log to create
	 * @returns {InsertResult}
	 * @throws {NoResultError} If could not create the goal log
	 */
	create: t.procedure
		.use(logger)
		.input(GoalLogSchema)
		.mutation(async ({ input }) => {
			return await getDb()
				.insertInto('goal_logs')
				.values({ ...input })
				.executeTakeFirstOrThrow();
		}),
	get: t.procedure
		.use(logger)
		.input(z.number())
		.query(async ({ input }) => {
			return await getDb()
				.selectFrom('goal_logs')
				.select(['type', 'date'])
				.where('goalId', '=', input)
				.execute();
		}),
	getAll: t.procedure.use(logger).query(async () => {
		return await getDb().selectFrom('goal_logs').select(['type', 'date', 'goalId']).execute();
	}),
	// Just update logs - for debugging purposes
	// TODO: Remove this
	reactivate: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			const goalId = input;

			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const latestLog = await trx
						.selectFrom('goal_logs')
						.select(['type'])
						.where('goalId', '=', goalId)
						.orderBy('date', 'desc')
						.executeTakeFirstOrThrow();

					if (latestLog.type === 'end') {
						return await trx
							.insertInto('goal_logs')
							.values({
								goalId: goalId,
								type: 'start',
								date: new Date().toISOString()
							})
							.execute();
					} else {
						throw new Error('REACTIVATE_GOAL_ERROR: Goal is already active');
					}
				});
		})
});
