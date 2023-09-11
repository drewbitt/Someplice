import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Intention } from '../types';
import { adjustToUTCStartAndEndOfDay } from '$src/lib/utils';

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
	/**
	 * List all intentions.
	 * @param input - The input object (optional).
	 * @param input.startDate - The start date to filter by.
	 * @param input.endDate - The end date to filter by.
	 * @param input.limit - The maximum number of results to return (optional).
	 * @param input.offset - The offset to start returning results from (optional).
	 * @param input.order - The order to sort the results by based on `orderNumber` (asc or desc, default is asc).
	 * @returns The intentions.
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
				.refine((data) => Boolean(data.startDate) === Boolean(data.endDate), {
					// TODO: Remove this requirement? Just that elsewhere they are always provided together.
					message: 'Both startDate and endDate must be provided together.',
					path: ['startDate', 'endDate']
				})
				.optional()
		)
		.query(async ({ input }) => {
			let query = getDb().selectFrom('intentions').selectAll();

			if (input) {
				query = query.orderBy('orderNumber', input.order);

				if (input.startDate && input.endDate) {
					const { startDate, endDate } = adjustToUTCStartAndEndOfDay(
						input.startDate,
						input.endDate
					);

					query = query
						.where('date', '>=', startDate.toISOString())
						.where('date', '<=', endDate.toISOString());
				}

				if (input.limit) {
					query = query.limit(input.limit);
				}
				if (input.offset) {
					query = query.offset(input.offset);
				}
			} else {
				query = query.orderBy('orderNumber', 'asc');
			}

			return await query.execute();
		}),

	/**
	 * List all intentions grouped by date.
	 * @param input - The input object.
	 * @param input.startDate - The start date to filter by.
	 * @param input.endDate - The end date to filter by.
	 * @param input.limit - The maximum number of intentions to return (optional).
	 * @param input.offset - The offset to start returning results from (optional).
	 * @returns The intentions grouped by date.
	 */
	listByDate: t.procedure
		.use(logger)
		.input(
			z.object({
				startDate: z.date(),
				endDate: z.date(),
				limit: z.number().optional(),
				offset: z.number().optional()
			})
		)
		.query(async ({ input }) => {
			const { startDate, endDate } = adjustToUTCStartAndEndOfDay(input.startDate, input.endDate);

			let query = getDb()
				.selectFrom('intentions')
				.selectAll()
				.orderBy('date', 'desc')
				.orderBy('orderNumber', 'asc')
				.where('date', '>=', startDate.toISOString())
				.where('date', '<=', endDate.toISOString());

			if (input.limit) {
				query = query.limit(input.limit);
			}
			if (input.offset) {
				query = query.offset(input.offset);
			}

			const intentions = await query.execute();

			// Group intentions by date
			const intentionsByDate = intentions.reduce(
				(acc: Record<string, Intention[]>, intention: Intention) => {
					// Set key to date in format YYYY-MM-DD
					const date = intention.date.slice(0, 10);
					if (!acc[date]) {
						acc[date] = [];
					}
					acc[date].push(intention);
					return acc;
				},
				{}
			);

			return intentionsByDate;
		}),
	/**
	 * List all unique dates that intentions exist for.
	 * Primarily for understanding and controlling pagination based on unique dates,
	 * or when you only want dates and not the intentions themselves.
	 * @param input - The input object (optional)
	 * @param input.startDate - The start date to filter by (optional)
	 * @param input.endDate - The end date to filter by.
	 * @param input.limit - The maximum number of results to return (optional).
	 * @param input.offset - The offset to start returning results from (optional).
	 * @returns The unique dates as strings, including the time (the time the last intention was added on that date)
	 */
	listUniqueDates: t.procedure
		.use(logger)
		.input(
			z
				.object({
					startDate: z.date().optional(),
					endDate: z.date().optional(),
					limit: z.number().optional(),
					offset: z.number().optional()
				})
				.refine((data) => Boolean(data.startDate) === Boolean(data.endDate), {
					// TODO: Remove this requirement? Just that elsewhere they are always provided together.
					message: 'Both startDate and endDate must be provided together.',
					path: ['startDate', 'endDate']
				})
				.optional()
		)
		.query(async ({ input }) => {
			let query = getDb()
				.selectFrom('intentions')
				.select('date')
				.distinct()
				.orderBy('date', 'desc');

			if (input?.startDate && input?.endDate) {
				const { startDate, endDate } = adjustToUTCStartAndEndOfDay(input.startDate, input.endDate);
				query = query
					.where('date', '>=', startDate.toISOString())
					.where('date', '<=', endDate.toISOString());
			}

			if (input?.limit) {
				query = query.limit(input.limit);
			}
			if (input?.offset) {
				query = query.offset(input.offset);
			}

			const result = await query.execute();
			return result;
		}),
	/**
	 * Retrieve all the intentions for the latest date that intentions exist for.
	 * @returns The intentions for the latest date, or an empty array if there are no intentions.
	 */
	intentionsOnLatestDate: t.procedure.use(logger).query(async () => {
		const maxDate = await getDb()
			.selectFrom('intentions')
			.select(['id', 'date'])
			.orderBy('date', 'desc')
			.executeTakeFirst();

		if (maxDate) {
			const maxDateObject = new Date(maxDate.date);
			const { startDate, endDate } = adjustToUTCStartAndEndOfDay(maxDateObject, maxDateObject);

			const result = await getDb()
				.selectFrom('intentions')
				.selectAll()
				.where('date', '>=', startDate.toISOString())
				.where('date', '<=', endDate.toISOString())
				.orderBy('orderNumber', 'asc')
				.execute();

			return result;
		} else {
			return [] as Intention[];
		}
	}),
	/**
	 * Add new intentions.
	 * This can be used instead of `updateIntentions`'s upsert if you only want to add new intentions.
	 * @param input - An array of intentions to add, omitting the 'id' property.
	 * @returns The ids of the created intentions.
	 */
	addMany: t.procedure
		.use(logger)
		.input(z.array(IntentionsSchema.omit({ id: true })))
		.mutation(async ({ input }) => {
			const result = await getDb().insertInto('intentions').values(input).returning('id').execute();

			return result;
		}),
	/**
	 * Edit single intention
	 * @param {IntentionsSchema} input - The intention to edit
	 * @returns {UpdateResult}
	 * @throws {NoResultError} If could not edit the intention
	 */
	edit: t.procedure
		.use(logger)
		.input(IntentionsSchema)
		.mutation(async ({ input }) => {
			if (!input.id) throw new Error('No id provided');
			const query = getDb()
				.updateTable('intentions')
				.set({
					goalId: input.goalId,
					orderNumber: input.orderNumber,
					completed: input.completed,
					text: input.text,
					subIntentionQualifier: input.subIntentionQualifier
				})
				.where('id', '=', input.id);
			const result = await query.executeTakeFirst();
			// executeTakeFirstOrThrow() does not work on updates where no rows are updated as nothing is returned?
			// Manual throw
			if (Number(result?.numUpdatedRows) === 0) {
				throw new NoResultError(query.toOperationNode());
			}
			return result;
		}),
	/**
	 * Append text to an intention's text.
	 * @param input - The input object.
	 * @param input.id - The id of the intention to edit.
	 * @param input.text - The text to append.
	 * @returns The result of the update operation.
	 * @throws If could not edit the intention.
	 */
	appendText: t.procedure
		.use(logger)
		.input(
			z.object({
				id: z.number(),
				text: z.string()
			})
		)
		.mutation(async ({ input }) => {
			if (!input.id) throw new Error('No id provided');
			const query = getDb()
				.updateTable('intentions')
				.set({
					text: sql`text || ${input.text}`
				})
				.where('id', '=', input.id);
			const result = await query.executeTakeFirst();
			// executeTakeFirstOrThrow() does not work on updates where no rows are updated as nothing is returned?
			// Manual throw
			if (Number(result?.numUpdatedRows) === 0) {
				throw new NoResultError(query.toOperationNode());
			}
			return result;
		}),
	/**
	 * Replace the intentions with the given intentions, based on the id.
	 * Also acts as an upsert - if the intention doesn't exist, it will be created.
	 * @param input - The input object.
	 * @param input.intentions - The intentions to update.
	 * @returns The rows parameter will always be defined, but empty since we're not returning anything.
	 */
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
		}),
	/**
	 * Update the completion status of intentions based on their IDs.
	 * @param input - An array of objects containing `intentionId` and `completed`.
	 * @throws {NoResultError} If could not update the intention's completion status.
	 */
	updateIntentionCompletionStatus: t.procedure
		.use(logger)
		.input(
			z.array(
				z.object({
					intentionId: z.number(),
					completed: z.number()
				})
			)
		)
		.mutation(async ({ input }) => {
			await getDb()
				.transaction()
				.execute(async (trx) => {
					await Promise.all(
						input.map(async (intentionUpdate) => {
							const query = trx
								.updateTable('intentions')
								.set({ completed: intentionUpdate.completed })
								.where('id', '=', intentionUpdate.intentionId);

							const result = await query.executeTakeFirst();

							// If no row is updated, throw an error
							if (Number(result?.numUpdatedRows) === 0) {
								throw new NoResultError(query.toOperationNode());
							}
						})
					);
				});
		})
});
