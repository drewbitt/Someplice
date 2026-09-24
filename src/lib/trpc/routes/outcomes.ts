import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { getDb } from '$src/lib/db/db';
import { linkIntentionToOutcome } from '$src/lib/db/queries';
import { z } from 'zod';
import { INTENTION_STATUSES, VERDICTS } from '../enums';
import { IntentionsSchema } from './intentions';

export const OutcomeSchema = z.object({
	id: z.number().nullable(),
	reviewed: z.number(),
	// date is ISOString without the time
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const VerdictSchema = z.object({
	goalId: z.number(),
	verdict: z.enum(VERDICTS),
	note: z.string().nullable().optional()
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
	 * @param input.orderBy - The order column (id or date, default is id).
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
				query = query.orderBy(input.orderBy, input.order);
			} else {
				query = query.orderBy('id', 'asc');
			}

			return query.execute();
		}),
	/**
	 * List per-goal verdicts for the given outcomes (used by the journey page,
	 * where each day-card knows its outcomeId).
	 */
	verdictsByOutcomeIds: t.procedure
		.use(logger)
		.input(z.object({ outcomeIds: z.array(z.number()) }))
		.query(({ input }) => {
			if (input.outcomeIds.length === 0) {
				return [];
			}
			return getDb()
				.selectFrom('outcome_verdicts')
				.selectAll()
				.where('outcomeId', 'in', input.outcomeIds)
				.execute();
		}),
	/**
	 * Save a review atomically: insert new intentions, apply status updates,
	 * upsert the day's outcome, link every intention to it, and rewrite the
	 * day's per-goal verdicts.
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
						status: z.enum(INTENTION_STATUSES)
					})
				),
				verdicts: z.array(VerdictSchema).default([])
			})
		)
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const intentionIds = input.statuses.map((status) => status.intentionId);

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

					await trx
						.deleteFrom('outcome_verdicts')
						.where('outcomeId', '=', outcome.id as number)
						.execute();
					if (input.verdicts.length > 0) {
						await trx
							.insertInto('outcome_verdicts')
							.values(
								input.verdicts.map((verdict) => ({
									outcomeId: outcome.id as number,
									goalId: verdict.goalId,
									verdict: verdict.verdict,
									note: verdict.note ?? null
								}))
							)
							.execute();
					}

					return { outcomeId: outcome.id };
				});
		})
});
