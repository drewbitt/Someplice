import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { z } from 'zod';

const getDb = () => DbInstance.getInstance().db;

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
				return getDb()
					.selectFrom('outcomes')
					.select(['id', 'reviewed', 'date'])
					.where('date', '=', input.toISOString().split('T')[0])
					.execute();
			} else {
				return getDb().selectFrom('outcomes').select(['id', 'reviewed', 'date']).execute();
			}
		}),
	listOutcomesIntentions: t.procedure
		.use(logger)
		.input(z.number())
		.query(({ input }) => {
			return getDb()
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
		// deepcode ignore Sqli: incorrectly reports sql injection
		.query(async ({ input }) => {
			const result = await getDb()
				.transaction()
				.execute(async (trx) => {
					const outcome = await trx
						.insertInto('outcomes')
						.values(input.outcome)
						.returning('id')
						.executeTakeFirstOrThrow();

					if (!outcome.id) throw new Error('Outcome id is null');

					for (const outcomesIntentionsInput of input.outcomesIntentions) {
						await trx
							.insertInto('outcomes_intentions')
							.values({ ...outcomesIntentionsInput, outcomeId: outcome.id })
							.executeTakeFirstOrThrow();
					}

					return { outcomeId: outcome.id };
				});

			return result;
		})
});
