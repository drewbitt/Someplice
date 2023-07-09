import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { db } from '$src/lib/db/db';
import { sql } from 'kysely';
import { z } from 'zod';
import { processUpdateResults } from '../middleware/utils';

export const IntentionsSchema = z.object({
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
					.orderBy('orderNumber', 'asc')
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
	/** Edit single intention */
	edit: t.procedure
		.use(logger)
		.input(IntentionsSchema)
		.mutation(async ({ input }) => {
			const result = await db
				.updateTable('intentions')
				.set({
					goalId: input.goalId,
					orderNumber: input.orderNumber,
					completed: input.completed,
					text: input.text,
					subIntentionQualifier: input.subIntentionQualifier
				})
				.where('id', '=', input.id)
				.execute();
			return processUpdateResults(result);
		}),
	appendText: t.procedure
		.use(logger)
		.input(
			z.object({
				id: z.number(),
				text: z.string()
			})
		)
		.mutation(async ({ input }) => {
			const result = await db
				.updateTable('intentions')
				.set({
					text: sql`text || ${input.text}`
				})
				.where('id', '=', input.id)
				.execute();
			return processUpdateResults(result);
		}),
	updateIntentions: t.procedure
		.use(logger)
		.input(
			z.object({
				intentions: z.array(IntentionsSchema)
			})
		)
		.mutation(async ({ input }) => {
			const results = await db.transaction().execute(async (trx) => {
				return await Promise.all(
					input.intentions.map((intention) => {
						return sql<
							typeof intention
						>`INSERT OR REPLACE INTO intentions (id, goalId, orderNumber, completed, text, subIntentionQualifier, date)
										 VALUES (${intention.id}, ${intention.goalId}, ${intention.orderNumber}, ${intention.completed},
										${intention.text}, ${intention.subIntentionQualifier}, ${intention.date}) RETURNING *`.execute(trx);
					})
				);
			});
			return results;
		})
});
