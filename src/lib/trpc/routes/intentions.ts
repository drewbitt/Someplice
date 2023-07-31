import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Intention } from '../types';

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
	/**
	 * Get all the intentions for the latest date
	 */
	intentionsOnLatestDate: t.procedure.use(logger).query(async () => {
		const maxDate = await getDb()
			.selectFrom('intentions')
			.select(['id', 'date'])
			.orderBy('date', 'desc')
			.executeTakeFirst();

		if (maxDate) {
			const startOfDate = new Date(maxDate.date);
			startOfDate.setHours(0, 0, 0, 0);

			const endOfDate = new Date(maxDate.date);
			endOfDate.setHours(23, 59, 59, 999);

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
	 * Append text to an intention's text
	 * @param { { id: number, text: string } } input - The intention to edit and the text to append
	 * @returns {UpdateResult}
	 * @throws {NoResultError} If could not edit the intention
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
	 * Replace the intentions with the given intentions, based on the id
	 * Also acts as an upsert - if the intention doesn't exist, it will be created
	 * @param { { intentions: Intention[] } } input - The intentions to update
	 * @returns {QueryResult<Intention>[]} - the rows parameter will always be defined, but empty since we're not returning anything
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
