import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { sql } from 'kysely';
import { z } from 'zod';

const getDb = () => DbInstance.getInstance().db;

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
				return getDb()
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
				return getDb()
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
	latestIntentions: t.procedure.use(logger).query(async () => {
		const maxDate = await getDb()
			.selectFrom('intentions')
			.select(['id', 'date'])
			.orderBy('date', 'desc')
			.limit(1)
			.execute();

		if (maxDate && maxDate[0]?.date) {
			return getDb()
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
				.where('date', '=', maxDate[0].date)
				.execute();
		} else {
			return [];
		}
	}),
	/** Edit single intention */
	edit: t.procedure
		.use(logger)
		.input(IntentionsSchema)
		.mutation(async ({ input }) => {
			const result = await getDb()
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
			return result;
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
			const result = await getDb()
				.updateTable('intentions')
				.set({
					text: sql`text || ${input.text}`
				})
				.where('id', '=', input.id)
				.execute();
			return result;
		}),
	updateIntentions: t.procedure
		.use(logger)
		.input(
			z.object({
				intentions: z.array(IntentionsSchema)
			})
		)
		.mutation(async ({ input }) => {
			const results = await getDb()
				.transaction()
				.execute(async (trx) => {
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
