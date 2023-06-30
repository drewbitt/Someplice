import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { db } from '$src/lib/db/db';
import { z } from 'zod';

export const GoalLogSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	type: z.string(),
	date: z.string()
});

export const goal_logs = t.router({
	create: t.procedure
		.use(logger)
		.input(GoalLogSchema)
		.mutation(async ({ input }) => {
			return await db
				.insertInto('goal_logs')
				.values({ ...input })
				.execute();
		}),
	get: t.procedure
		.use(logger)
		.input(z.number())
		.query(async ({ input }) => {
			return await db
				.selectFrom('goal_logs')
				.select(['type', 'date'])
				.where('goalId', '=', input)
				.execute();
		})
});
