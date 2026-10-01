import { logger } from '#lib/trpc/middleware/logger.js';
import { procedure, t } from '#lib/trpc/t.js';
import { TRPCError } from '@trpc/server';
import { getDb } from '#src/lib/db/db.js';
import { linkIntentionToOutcome } from '#src/lib/db/queries.js';
import { sql } from 'kysely';
import { z } from 'zod';
import { INTENTION_STATUSES, VERDICTS } from '../enums';
import { IntentionsSchema } from './intentions';

export const OutcomeSchema = z.object({
	id: z.number().nullable(),
	reviewed: z.number(),
	// date is ISOString without the time; the refine rejects rollover values like
	// 2026-02-30 that would store fine but never match a real day's bounds. The
	// NaN guard keeps unparseable shapes (month 13) from throwing RangeError in zod.
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.refine(
			(value) => {
				const parsed = new Date(`${value}T00:00:00.000Z`);
				return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
			},
			{ message: 'date must be a real calendar day' }
		)
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
	 * @param input.orderBy - The column to order the results by (either 'id' or 'date', default is 'id').
	 * @returns An array of `Outcome` objects.
	 */
	list: procedure
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
	 * List per-goal verdicts for the given outcomes (used by the journey page,
	 * where each day-card knows its outcomeId).
	 */
	verdictsByOutcomeIds: procedure
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
	 * upsert the day's outcome, and link every intention to it — all in one
	 * transaction so a failed save leaves nothing behind and can be retried.
	 * @param input.outcome - `date` and `reviewed` for the outcome row.
	 * @param input.newIntentions - New intentions to insert (without ids).
	 * @param input.statuses - `intentionId`/`status` pairs for existing intentions.
	 * @param input.verdicts - Per-goal verdicts for the outcome.
	 * @returns `{ outcomeId }` of the upserted outcome.
	 */
	saveReview: procedure
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

					// A review is scoped to its day: new intentions must carry that day,
					// and status/link targets must already live on it. Otherwise a
					// foreign id would bind another day's intention to this outcome.
					for (const intention of input.newIntentions) {
						if (intention.date.slice(0, 10) !== input.outcome.date) {
							throw new TRPCError({
								code: 'BAD_REQUEST',
								message: 'New intentions must belong to the reviewed outcome date'
							});
						}
					}
					if (intentionIds.length > 0) {
						const days = await trx
							.selectFrom('intentions')
							.select(['id', sql<string>`DATE("date")`.as('day')])
							.where('id', 'in', intentionIds)
							.execute();
						const dayById = new Map(days.map((row) => [row.id, row.day]));
						for (const intentionId of intentionIds) {
							const day = dayById.get(intentionId);
							if (day !== undefined && day !== input.outcome.date) {
								throw new TRPCError({
									code: 'BAD_REQUEST',
									message: `Intention ${intentionId} does not belong to outcome date ${input.outcome.date}`
								});
							}
						}
					}

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
