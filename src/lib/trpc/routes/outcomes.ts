import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { db } from '$src/lib/db/db';
import { z } from 'zod';

export const OutcomeSchema = z.object({
	id: z.number().nullable(),
	reviewed: z.number(),
	// date is ISOString without the time
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const OutcomeIntentionSchema = z.object({
	outcomeId: z.number(),
	intentionId: z.number()
});

export const outcomes = t.router({
	list: t.procedure
		.use(logger)
		.input(z.date().optional())
		.query(({ input }) => {
			if (input) {
				return db
					.selectFrom('outcomes')
					.select(['id', 'reviewed', 'date'])
					.where('date', '=', input.toISOString().split('T')[0])
					.execute();
			} else {
				return db.selectFrom('outcomes').select(['id', 'reviewed', 'date']).execute();
			}
		}),
	listOutcomesIntentions: t.procedure
		.use(logger)
		.input(z.number())
		.query(({ input }) => {
			return db
				.selectFrom('outcomes_intentions')
				.select(['outcomeId', 'intentionId'])
				.where('outcomeId', '=', input)
				.execute();
		}),
	create: t.procedure
		.use(logger)
		.input(
			z.object({
				outcome: OutcomeSchema,
				outcomesIntentions: z.array(
					z.object({
						intentionId: z.number()
					})
				)
			})
		)
		.query(async ({ input }) => {
			const result = await db.transaction().execute(async (trx) => {
				const outcome = await trx
					.insertInto('outcomes')
					.values(input.outcome)
					.returning('id')
					.executeTakeFirst();

				if (!outcome || !outcome.id) {
					throw new Error('Failed to insert outcome');
				}

				for (const outcomesIntentionsInput of input.outcomesIntentions) {
					await trx
						.insertInto('outcomes_intentions')
						.values({ ...outcomesIntentionsInput, outcomeId: outcome.id })
						.execute();
				}

				return { outcomeId: outcome.id };
			});

			return result;
		})
});
