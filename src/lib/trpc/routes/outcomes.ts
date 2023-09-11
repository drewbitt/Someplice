import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { sql } from 'kysely';
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
	/**
	 * List all outcomes.
	 * @param input - The input object (optional).
	 * @param input.startDate - The start date to filter by (optional).
	 * @param input.endDate - The end date to filter by (optional).
	 * @param input.limit - The maximum number of results to return (optional).
	 * @param input.offset - The offset to start returning results from (optional).
	 * @param input.order - The order to sort the results by (asc or desc, default is asc).
	 * @returns An array of `Outcome` objects.
	 */
	list: t.procedure
		.use(logger)
		.input(
			z
				.object({
					startDate: z.date().optional(),
					endDate: z.date().optional(),
					limit: z.number().optional(),
					offset: z.number().optional(),
					order: z
						.union([z.literal('asc'), z.literal('desc')])
						.optional()
						.default('asc')
				})
				.optional()
		)
		.query(({ input }) => {
			let query = getDb().selectFrom('outcomes').selectAll();

			if (input) {
				if (input.startDate) {
					query = query.where('date', '>=', input.startDate.toISOString().split('T')[0]);
				}
				if (input.endDate) {
					query = query.where('date', '<=', input.endDate.toISOString().split('T')[0]);
				}
				if (input.limit) {
					query = query.limit(input.limit);
				}
				if (input.offset) {
					query = query.offset(input.offset);
				}
				query = query.orderBy('id', input.order);
			} else {
				query = query.orderBy('id', 'asc');
			}

			return query.execute();
		}),
	/**
	 * List all intentions associated with an outcome.
	 * @param input - The outcome id.
	 * @returns An array of `OutcomeIntention` objects.
	 */
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
	/**
	 * Create a new outcome.
	 * @param input.outcome - The `Outcome` object, omitting `id`.
	 * @param input.outcomesIntentions - Array of objects containing `intentionId`.
	 * @returns An object containing the `outcomeId` of the created outcome.
	 * @throws {NoResultError} - If the outcome could not be created or updated.
	 * @throws {NoResultError} - If the `outcome_intentions` could not be created.
	 */
	create: t.procedure
		.use(logger)
		.input(
			z.object({
				outcome: OutcomeSchema.omit({ id: true }),
				outcomesIntentions: z.array(OutcomeIntentionSchema.pick({ intentionId: true }))
			})
		)
		// deepcode ignore Sqli: incorrectly reports sql injection
		.mutation(async ({ input }) => {
			const result = await getDb()
				.transaction()
				.execute(async (trx) => {
					// First, check if there's an outcome, as outcome dates are unique
					const existingOutcome = await trx
						.selectFrom('outcomes')
						.selectAll()
						.where('date', '=', input.outcome.date)
						.executeTakeFirst();

					if (existingOutcome) {
						// Just update the reviewed of the outcome
						const updatedOutcome = await trx
							.updateTable('outcomes')
							.set({ reviewed: input.outcome.reviewed })
							.where('id', '=', existingOutcome.id)
							.returning('id')
							.executeTakeFirstOrThrow();

						return { outcomeId: updatedOutcome.id };
					} else {
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
					}
				});

			return result;
		}),
	/**
	 * Create or update an outcome based on the provided data.
	 * This method either creates a new outcome if it doesn't exist based on its date,
	 * or updates the 'reviewed' status if the outcome already exists.
	 * It also associates the provided intentions with the outcome.
	 *
	 * @param input.outcome - The `Outcome` object without the 'id'.
	 * @param input.intentionIds - Array of intention IDs to associate with the outcome.
	 * @returns An object containing the `outcomeId` of the created or updated outcome.
	 * @throws {NoResultError} - If the outcome or its associations could not be created or updated.
	 */
	createOrUpdateOutcome: t.procedure
		.use(logger)
		.input(
			z.object({
				outcome: OutcomeSchema.omit({ id: true }),
				intentionIds: z.array(z.number()) // Array of intention IDs
			})
		)
		.mutation(async ({ input }) => {
			const result = await getDb()
				.transaction()
				.execute(async (trx) => {
					const existingOutcome = await trx
						.selectFrom('outcomes')
						.selectAll()
						.where('date', '=', input.outcome.date)
						.executeTakeFirst();

					if (existingOutcome) {
						const updatedOutcome = await trx
							.updateTable('outcomes')
							.set({ reviewed: input.outcome.reviewed })
							.where('id', '=', existingOutcome.id)
							.returning('id')
							.executeTakeFirstOrThrow();

						// Upsert associations for existing outcome
						for (const intentionId of input.intentionIds) {
							await sql<{
								outcomeId: number;
								intentionId: number;
							}>`INSERT OR REPLACE INTO outcomes_intentions (outcomeId, intentionId) 
                          VALUES (${updatedOutcome.id}, ${intentionId})`.execute(trx);
						}

						return { outcomeId: updatedOutcome.id };
					} else {
						const outcome = await trx
							.insertInto('outcomes')
							.values(input.outcome)
							.returning('id')
							.executeTakeFirstOrThrow();

						if (!outcome.id) throw new Error('Outcome id is null');

						// Directly insert associations for new outcome
						for (const intentionId of input.intentionIds) {
							await trx
								.insertInto('outcomes_intentions')
								.values({ outcomeId: outcome.id, intentionId: intentionId })
								.returning(['outcomeId', 'intentionId'])
								.executeTakeFirstOrThrow();
						}

						return { outcomeId: outcome.id };
					}
				});

			return result;
		})
});
