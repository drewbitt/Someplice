import { logger } from '#lib/trpc/middleware/logger.js';
import { procedure, t } from '#lib/trpc/t.js';
import { getDb } from '#lib/db/db.js';
import { z } from 'zod';

export const GoalLogSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	type: z.enum(['start', 'end', 'reorder']),
	date: z.string(),
	orderNumber: z.number().nullable()
});

export const goal_logs = t.router({
	/**
	 * Get all goal logs for a goal.
	 * @param input - The goal ID.
	 * @returns An array of `GoalLog` objects.
	 * @throws {NoResultError} If could not find any goal logs for the goal.
	 */
	getAllForGoal: procedure
		.use(logger)
		.input(z.number())
		.query(async ({ input }) => {
			// Check if goal exists and throw error if not
			await getDb()
				.selectFrom('goals')
				.select(['id'])
				.where('id', '=', input)
				.executeTakeFirstOrThrow();

			return await getDb()
				.selectFrom('goal_logs')
				.selectAll()
				.where('goalId', '=', input)
				.execute();
		}),
	/**
	 * Get all goal logs.
	 * @returns An array of `GoalLog` objects.
	 */
	getAll: procedure.use(logger).query(async () => {
		return await getDb().selectFrom('goal_logs').selectAll().execute();
	})
});
