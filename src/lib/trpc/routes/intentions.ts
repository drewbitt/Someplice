import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Intention } from '../types';
import { trpcLogger } from '$src/lib/utils/logger';

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
	 * @returns The intentions.
	 */
	list: t.procedure
		.use(logger)
		.input(
			z
				.object({
					startDate: z.date(),
					endDate: z.date(),
					limit: z.number().optional(),
					offset: z.number().optional()
				})
				.optional()
		)
		.query(async ({ input }) => {
			const query = getDb()
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
				.orderBy('orderNumber', 'asc');

			if (input) {
				const startDate = new Date(
					Date.UTC(
						input.startDate.getUTCFullYear(),
						input.startDate.getUTCMonth(),
						input.startDate.getUTCDate()
					)
				);
				startDate.setUTCHours(0, 0, 0, 0);
				const endDate = new Date(
					Date.UTC(
						input.endDate.getUTCFullYear(),
						input.endDate.getUTCMonth(),
						input.endDate.getUTCDate()
					)
				);
				endDate.setUTCHours(23, 59, 59, 999);

				query
					.where('date', '>=', startDate.toISOString())
					.where('date', '<=', endDate.toISOString());

				if (input.limit) {
					query.limit(input.limit);
				}
				if (input.offset) {
					query.offset(input.offset);
				}
			}
			return await query.execute();
		}),
	/**
	 * List all intentions grouped by date.
	 * @param input - The input object.
	 * @param input.startDate - The start date to filter by.
	 * @param input.endDate - The end date to filter by.
	 * @param input.limit - The maximum number of results to return (optional).
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
			const startDate = new Date(
				Date.UTC(
					input.startDate.getUTCFullYear(),
					input.startDate.getUTCMonth(),
					input.startDate.getUTCDate()
				)
			);
			startDate.setUTCHours(0, 0, 0, 0);
			const endDate = new Date(
				Date.UTC(
					input.endDate.getUTCFullYear(),
					input.endDate.getUTCMonth(),
					input.endDate.getUTCDate()
				)
			);
			endDate.setUTCHours(23, 59, 59, 999);
			trpcLogger.debug('listByDate', { startDate, endDate });

			const query = getDb()
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
				.orderBy('date', 'asc')
				.orderBy('orderNumber', 'asc')
				.where('date', '>=', startDate.toISOString())
				.where('date', '<=', endDate.toISOString());

			if (input.limit) {
				query.limit(input.limit);
			}
			if (input.offset) {
				query.offset(input.offset);
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
	 * @param input - The input object.
	 * @param input.startDate - The start date to filter by.
	 * @param input.endDate - The end date to filter by.
	 * @param input.limit - The maximum number of results to return (optional).
	 * @param input.offset - The offset to start returning results from (optional).
	 * @returns The unique dates.
	 */
	listUniqueDates: t.procedure
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
			const startDate = new Date(
				Date.UTC(
					input.startDate.getUTCFullYear(),
					input.startDate.getUTCMonth(),
					input.startDate.getUTCDate()
				)
			);
			startDate.setUTCHours(0, 0, 0, 0);

			const endDate = new Date(
				Date.UTC(
					input.endDate.getUTCFullYear(),
					input.endDate.getUTCMonth(),
					input.endDate.getUTCDate()
				)
			);
			endDate.setUTCHours(23, 59, 59, 999);

			const query = getDb()
				.selectFrom('intentions')
				.select('date')
				.distinct()
				.orderBy('date', 'asc')
				.where('date', '>=', startDate.toISOString())
				.where('date', '<=', endDate.toISOString());
			if (input.limit) {
				query.limit(input.limit);
			}
			if (input.offset) {
				query.offset(input.offset);
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
			const startOfDate = new Date(
				Date.UTC(
					maxDateObject.getUTCFullYear(),
					maxDateObject.getUTCMonth(),
					maxDateObject.getUTCDate()
				)
			);
			startOfDate.setUTCHours(0, 0, 0, 0);

			const endOfDate = new Date(
				Date.UTC(
					maxDateObject.getUTCFullYear(),
					maxDateObject.getUTCMonth(),
					maxDateObject.getUTCDate()
				)
			);
			endOfDate.setUTCHours(23, 59, 59, 999);

			const result = await getDb()
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
				.where('date', '>=', startOfDate.toISOString())
				.where('date', '<=', endOfDate.toISOString())
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
		})
});
