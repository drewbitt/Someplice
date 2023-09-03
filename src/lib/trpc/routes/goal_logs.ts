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
	 * Create a new goal log.
	 * @param input - The `GoalLog` object to create.
	 * @returns An `InsertResult` object.
	 * @throws {NoResultError} If could not create the goal log.
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
	/**
	 * Get all goal logs for a goal.
	 * @param input - The goal ID.
	 * @returns An array of `GoalLog` objects.
	 * @throws {NoResultError} If could not find any goal logs for the goal.
	 */
	getAllForGoal: t.procedure
		.use(logger)
		.input(z.number())
		.query(async ({ input }) => {
			// Check if goal exists and throw error if not
			await getDb()
				.selectFrom('goals')
				.select(['id'])
				.where('id', '=', input)
				.executeTakeFirstOrThrow();

			const result = await getDb()
				.selectFrom('goal_logs')
				.selectAll()
				.where('goalId', '=', input)
				.execute();
			return result;
		}),
	/**
	 * Get all goal logs.
	 * @returns An array of `GoalLog` objects.
	 */
	getAll: t.procedure.use(logger).query(async () => {
		return await getDb().selectFrom('goal_logs').selectAll().execute();
	})
});
