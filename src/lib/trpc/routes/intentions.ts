import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { z } from 'zod';
import { db } from '$src/lib/db/db';

const IntentionsSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	orderNumber: z.number(),
	completed: z.number(),
	text: z.string(),
	subIntentionQualifier: z.string().nullable(),
	date: z.string()
});

export const intentions = t.router({
	list: t.procedure
		.use(logger)
		.input(
			z
				.object({
					startDate: z.string(),
					endDate: z.string()
				})
				.optional()
		)
		.query(({ input }) => {
			if (input) {
				return db
					.selectFrom('intentions')
					.select([
						'id',
						'goalId',
						'orderNumber',
						'completed',
						'text',
						'subIntentionQualifier',
						'date'
					])
					.where('date', '>=', input.startDate)
					.where('date', '<=', input.endDate)
					.execute();
			} else {
				return db
					.selectFrom('intentions')
					.select([
						'id',
						'goalId',
						'orderNumber',
						'completed',
						'text',
						'subIntentionQualifier',
						'date'
					])
					.execute();
			}
		}),
	add: t.procedure
		.use(logger)
		.input(z.array(IntentionsSchema))
		.mutation(({ input }) => {
			return db.insertInto('intentions').values(input).execute();
		}),
	updateIntentions: t.procedure
		.use(logger)
		.input(
			z.object({
				intentions: z.array(IntentionsSchema)
			})
		)
		.mutation(async ({ input }) => {
			await db.transaction().execute(async (tx) => {
				return await Promise.all(
					input.intentions.map((intention) => {
						return tx
							.updateTable('intentions')
							.set({
								goalId: intention.goalId,
								orderNumber: intention.orderNumber,
								completed: intention.completed,
								text: intention.text,
								subIntentionQualifier: intention.subIntentionQualifier,
								date: intention.date
							})
							.where('id', '=', intention.id)
							.execute();
					})
				);
			});
		})
});
