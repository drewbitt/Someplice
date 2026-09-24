import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { linkIntentionToOutcome } from '$src/lib/db/queries';
import { z } from 'zod';
import { IntentionsSchema } from './intentions';

const getDb = () => DbInstance.getInstance().db;

export const OutcomeSchema = z.object({
	id: z.number().nullable(),
	reviewed: z.number(),
	// date is ISOString without the time
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
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
	 * @param input.orderBy - The column to order the results by (either 'id' or 'date', default is 'id').
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
						.default('asc'),
					orderBy: z
						.union([z.literal('id'), z.literal('date')])
						.optional()
						.default('id')
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
				query = query.orderBy(input.orderBy || 'id', input.order);
			} else {
				query = query.orderBy('id', 'asc');
			}

			return query.execute();
		}),
	/**
	 * Save a review atomically: insert new intentions, apply completion updates,
	 * upsert the day's outcome, and link every intention to it — all in one
	 * transaction so a failed save leaves nothing behind and can be retried.
	 * @param input.outcome - `date` and `reviewed` for the outcome row.
	 * @param input.newIntentions - New intentions to insert (without ids).
	 * @param input.statuses - `intentionId`/`status` pairs for existing intentions.
	 * @returns `{ outcomeId }` of the upserted outcome.
	 */
	saveReview: t.procedure
		.use(logger)
		.input(
			z.object({
				outcome: OutcomeSchema.omit({ id: true }),
				newIntentions: z.array(IntentionsSchema.omit({ id: true })),
				statuses: z.array(
					z.object({
						intentionId: z.number(),
						status: z.enum(['pending', 'done', 'not_today'])
					})
				)
			})
		)
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const intentionIds = input.statuses.map((c) => c.intentionId);

					if (input.newIntentions.length > 0) {
						const inserted = await trx
							.insertInto('intentions')
							.values(input.newIntentions)
							.returning('id')
							.execute();
						for (const row of inserted) {
							intentionIds.push(row.id as number);
						}
					}

					for (const { intentionId, status } of input.statuses) {
						await trx
							.updateTable('intentions')
							.set({ status })
							.where('id', '=', intentionId)
							.executeTakeFirstOrThrow();
					}

					// outcomes.date is UNIQUE: insert, or update `reviewed` on the existing row
					const outcome = await trx
						.insertInto('outcomes')
						.values(input.outcome)
						.onConflict((oc) =>
							oc.column('date').doUpdateSet((eb) => ({
								reviewed: eb.ref('excluded.reviewed')
							}))
						)
						.returning('id')
						.executeTakeFirstOrThrow();

					for (const intentionId of intentionIds) {
						await linkIntentionToOutcome(trx, outcome.id as number, intentionId);
					}

					return { outcomeId: outcome.id };
				});
		})
});
