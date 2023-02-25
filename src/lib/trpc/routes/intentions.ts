import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { z } from 'zod';
import { db } from '$src/lib/db/db';
import { sql } from 'kysely';

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
	updateIntentions: t.procedure
		.use(logger)
		.input(
			z.object({
				intentions: z.array(IntentionsSchema)
			})
		)
		.mutation(async ({ input }) => {
			// TODO: This is terribly inefficient

			// If orderNumber on current day already exists, update the intention
			// Otherwise, insert the intention
			// Do not allow for duplicate orderNumbers on the same day

			const intentions = await db
				.selectFrom('intentions')
				.select(['orderNumber'])
				// where date is today
				.where(sql`strftime ('%Y-%m-%d', date)`, '=', sql`strftime ('%Y-%m-%d', 'now')`)
				.execute();
			const existingOrderNumbers = intentions.map((intention) => intention.orderNumber);
			const brandNewIntentions = input.intentions.filter(
				(intention) => !existingOrderNumbers.includes(intention.orderNumber)
			);
			// Insert brand new intentions
			if (brandNewIntentions.length > 0) {
				console.log(
					'🚀 ~ file: intentions.ts:87 ~ .mutation ~ brandNewIntentions:',
					brandNewIntentions
				);
				return await db.insertInto('intentions').values(brandNewIntentions).execute();
			}
			const existingIntentions = input.intentions.filter((intention) =>
				existingOrderNumbers.includes(intention.orderNumber)
			);
			// Update existing intentions
			// return existingIntentions.map((intention) => {
			// 	return db
			// 		.updateTable('intentions')
			// 		.set({
			// 			goalId: intention.goalId,
			// 			orderNumber: intention.orderNumber,
			// 			completed: intention.completed,
			// 			text: intention.text,
			// 			subIntentionQualifier: intention.subIntentionQualifier
			// 		})
			// 		.where('orderNumber', '=', intention.orderNumber)
			// 		.execute();
			// });
		})
});
