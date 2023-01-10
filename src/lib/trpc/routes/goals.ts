import { t } from '$lib/trpc/t';
import { z } from 'zod';
import { db } from '$src/lib/db/db';

export const goals = t.router({
	list: t.procedure.query(() =>
		db.selectFrom('goals').select(['id', 'title', 'description']).execute()
	),
	add: t.procedure
		.input(
			z.object({
				title: z.string(),
				description: z.string().optional()
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
