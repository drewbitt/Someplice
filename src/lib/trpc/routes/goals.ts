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
				title: z.string(),
				description: z.string().optional(),
				color: z.string()
			})
		)
		.mutation(async ({ input }) => {
			// get orderNumber by getting the max orderNumber of active goals and adding 1
			const maxOrderNumber = await db
				.selectFrom('goals')
				.select('orderNumber')
				.where('active', '=', 1)
				.orderBy('orderNumber', 'desc')
				.limit(1)
				.execute();
			const orderNumber = maxOrderNumber[0].orderNumber + 1;

			const insertion = await db
				.insertInto('goals')
				.values({ ...input, orderNumber })
				.execute();

			if (insertion) {
				console.log('Inserted goal');
			}
		})
});
