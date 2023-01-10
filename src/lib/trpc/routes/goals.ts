import { t } from '$lib/trpc/t';
import { z } from 'zod';
import { db } from '$src/lib/db/db';

export const goals = t.router({
	list: t.procedure.query(() =>
		db
			.selectFrom('goals')
			.select(['id', 'active', 'orderNumber', 'title', 'description', 'color'])
			.execute()
	),
	add: t.procedure
		.input(
			z.object({
				active: z.number(),
				orderNumber: z.number(),
				title: z.string(),
				description: z.string().optional(),
				color: z.string()
			})
		)
		.mutation(async ({ input }) => {
			const insertion = await db
				.insertInto('goals')
				.values({ ...input })
				.execute();

			if (insertion) {
				console.log('Inserted goal');
			}
		})
});
