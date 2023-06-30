import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { db } from '$src/lib/db/db';
import { z } from 'zod';

export const GoalLogSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	startDate: z.string(),
	endDate: z.string().nullable()
});

export const goal_logs = t.router({
	start: t.procedure
		.use(logger)
		.input(GoalLogSchema.omit({ endDate: true }))
		.mutation(async ({ input }) => {
			return await db
				.insertInto('goal_logs')
				.values({ ...input })
				.execute();
		}),
	end: t.procedure
		.use(logger)
		.input(GoalLogSchema.omit({ startDate: true, id: true }))
		.mutation(async ({ input }) => {
			return await db
				.updateTable('goal_logs')
				.set({ endDate: input.endDate })
				.where('goalId', '=', input.goalId)
				.execute();
		}),
	get: t.procedure
		.use(logger)
		.input(z.number())
		.query(async ({ input }) => {
			return await db
				.selectFrom('goal_logs')
				.select(['startDate', 'endDate'])
				.where('goalId', '=', input)
				.execute();
		})
});
