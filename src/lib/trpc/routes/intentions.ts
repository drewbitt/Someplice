import { logger } from '$lib/trpc/middleware/logger';
import { procedure, t } from '$lib/trpc/t';
import { TRPCError } from '@trpc/server';
import { getDb } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import { deleteOrphanedOutcomes } from '$src/lib/db/queries';
import { adjustToUTCStartAndEndOfDay } from '$src/lib/utils';
import { INTENTION_STATUSES as intentionStatuses } from '../enums';

export const INTENTION_STATUSES = intentionStatuses;
export const IntentionsSchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	orderNumber: z.number(),
	status: z.enum(INTENTION_STATUSES),
	text: z.string(),
	subIntentionQualifier: z.string().nullable(),
	// strftime-normalized wall clock (toISOString shape); the table CHECK demands
	// exactly this form, and older databases without the COALESCE'd CHECK would
	// otherwise store anything. The refine rejects regex-valid impossibilities like
	// 2026-02-30 or T24:00 that roll over to a different instant, and the NaN guard
	// keeps unparseable shapes (month 13, hour 25) from throwing RangeError in zod.
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
		.refine(
			(value) => {
				const parsed = new Date(value);
				return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
			},
			{ message: 'date must be a real instant in canonical toISOString() form' }
		)
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
			let query = getDb()
				.selectFrom('intentions')
				.selectAll()
				.orderBy('orderNumber', input?.order ?? 'asc');

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
	listByDate: procedure
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
				(acc: Record<string, typeof intentions>, intention) => {
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
	 * @returns An array of unique dates as strings in the format "YYYY-MM-DD"
	 */
	listUniqueDates: procedure
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
					message: 'Both startDate and endDate must be provided together.',
					path: ['startDate', 'endDate']
				})
				.optional()
		)
		.query(async ({ input }) => {
			let query = getDb()
				.selectFrom('intentions')
				// Extract the date from the datetime column, group by it, and set alias to "date".
				.select(sql<string>`DATE(date)`.as('date'))
				.groupBy(sql`DATE(date)`)
				.orderBy('date', 'desc');

			if (input?.startDate && input?.endDate) {
				const { startDate, endDate } = adjustToUTCStartAndEndOfDay(input.startDate, input.endDate);
				query = query
					.where(sql`DATE(date)`, '>=', startDate.toISOString().split('T')[0]) // Extract just the date part
					.where(sql`DATE(date)`, '<=', endDate.toISOString().split('T')[0]); // Extract just the date part
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
	intentionsOnLatestDate: procedure.use(logger).query(async () => {
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
			return [];
		}
	}),
	/**
	 * Edit single intention
	 * @param {IntentionsSchema} input - The intention to edit
	 * @returns {UpdateResult}
	 * @throws {NoResultError} If could not edit the intention
	 */
	edit: procedure
		.use(logger)
		.input(
			// Only the fields edit is allowed to change; orderNumber is owned by
			// updateIntentions so reordering via edit can't trip the unique index.
			IntentionsSchema.pick({
				id: true,
				status: true,
				text: true,
				subIntentionQualifier: true
			}).extend({ id: z.number() })
		)
		.mutation(async ({ input }) => {
			const query = getDb()
				.updateTable('intentions')
				.set({
					status: input.status,
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
	/** Set the status of multiple intentions without changing their ordering. */
	setStatus: procedure
		.use(logger)
		.input(
			z.object({
				ids: z.array(z.number()).min(1),
				status: z.enum(INTENTION_STATUSES)
			})
		)
		.mutation(async ({ input }) =>
			getDb()
				.updateTable('intentions')
				.set({ status: input.status })
				.where('id', 'in', input.ids)
				.executeTakeFirst()
		),
	/**
	 * Append text to an intention's text.
	 * @param input - The input object.
	 * @param input.id - The id of the intention to edit.
	 * @param input.text - The text to append.
	 * @returns The result of the update operation.
	 * @throws If could not edit the intention.
	 */
	appendText: procedure
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
	updateIntentions: procedure
		.use(logger)
		.input(
			z.object({
				intentions: z.array(IntentionsSchema)
			})
		)
		.mutation(async ({ input }) => {
			if (input.intentions.length === 0) {
				return [];
			}
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const inputByDate = new Map<string, typeof input.intentions>();
					for (const intention of input.intentions) {
						const dateKey = intention.date.slice(0, 10);
						inputByDate.set(dateKey, [...(inputByDate.get(dateKey) ?? []), intention]);
					}

					// An existing intention's day is immutable: moving it across days
					// would silently unlink it from its day's outcome and reorder a
					// different day's numbering. Deletes + inserts are the move API.
					const updateIds = input.intentions
						.filter((intention) => intention.id !== null)
						.map((intention) => intention.id as number);
					if (updateIds.length > 0) {
						const existingDays = await trx
							.selectFrom('intentions')
							.select(['id', sql<string>`DATE("date")`.as('day')])
							.where('id', 'in', updateIds)
							.execute();
						const dayById = new Map(existingDays.map((row) => [row.id, row.day]));
						for (const intention of input.intentions) {
							if (
								intention.id !== null &&
								dayById.has(intention.id) &&
								dayById.get(intention.id) !== intention.date.slice(0, 10)
							) {
								throw new TRPCError({
									code: 'BAD_REQUEST',
									message: `Intention ${intention.id} cannot move to a different date`
								});
							}
						}
					}

					// The unique index on (DATE(date), orderNumber) can't be deferred, so a
					// permutation (e.g. swapping two intentions) would collide mid-statement.
					// Submitted rows move to a scratch range first. Only when a submitted
					// orderNumber lands on an omitted row's slot does the WHOLE date move
					// and the leftovers renumber: the client may send a subset of rows (a
					// field-only update), and treating it as a reorder would silently
					// scramble the order of untouched rows.
					const reorderedDates = new Set<string>();
					for (const [dateKey, rows] of inputByDate) {
						const inputIds = rows
							.filter((intention) => intention.id !== null)
							.map((intention) => intention.id as number);
						if (inputIds.length === 0) continue;
						const existing = await trx
							.selectFrom('intentions')
							.select(['id', 'orderNumber'])
							.where(sql`DATE("date")`, '=', dateKey)
							.execute();
						const inputIdSet = new Set(inputIds);
						const submittedIds = existing
							.filter((row) => row.id !== null && inputIdSet.has(row.id))
							.map((row) => row.id as number);
						if (submittedIds.length === 0) continue;
						const omittedOrderNumbers = new Set(
							existing
								.filter((row) => row.id === null || !inputIdSet.has(row.id))
								.map((row) => row.orderNumber)
						);
						const reordersOmitted = rows.some((intention) =>
							omittedOrderNumbers.has(intention.orderNumber)
						);
						if (reordersOmitted) {
							reorderedDates.add(dateKey);
							await trx
								.updateTable('intentions')
								.set({
									orderNumber: sql`"orderNumber" + ((SELECT COALESCE(MAX("orderNumber"), 0) FROM "intentions") + 1)`
								})
								.where(sql`DATE("date")`, '=', dateKey)
								.execute();
						} else {
							// Field-only update: scratch just the submitted rows (covers
							// swaps inside the payload); omitted rows keep their
							// positions verbatim.
							await trx
								.updateTable('intentions')
								.set({
									orderNumber: sql`"orderNumber" + ((SELECT COALESCE(MAX("orderNumber"), 0) FROM "intentions") + 1)`
								})
								.where('id', 'in', submittedIds)
								.execute();
						}
					}

					const results = await trx
						.insertInto('intentions')
						.values(input.intentions)
						.onConflict((oc) =>
							oc.column('id').doUpdateSet((eb) => ({
								goalId: eb.ref('excluded.goalId'),
								orderNumber: eb.ref('excluded.orderNumber'),
								status: eb.ref('excluded.status'),
								text: eb.ref('excluded.text'),
								subIntentionQualifier: eb.ref('excluded.subIntentionQualifier'),
								date: eb.ref('excluded.date')
							}))
						)
						.returningAll()
						.execute();

					// Same-date rows that were not part of the input trail the input's
					// orderNumbers, keeping their prior relative order.
					const persistedIds = new Set(results.map((row) => row.id));
					for (const dateKey of reorderedDates) {
						const rows = inputByDate.get(dateKey)!;
						const maxInputOrderNumber = Math.max(...rows.map((intention) => intention.orderNumber));
						let leftoverQuery = trx
							.selectFrom('intentions')
							.select(['id', 'orderNumber'])
							.where(sql`DATE("date")`, '=', dateKey)
							.orderBy('orderNumber', 'asc');
						if (persistedIds.size > 0) {
							leftoverQuery = leftoverQuery.where('id', 'not in', [...persistedIds]);
						}
						const leftovers = await leftoverQuery.execute();
						let orderNumber = maxInputOrderNumber + 1;
						for (const leftover of leftovers) {
							await trx
								.updateTable('intentions')
								.set({ orderNumber: orderNumber++ })
								.where('id', '=', leftover.id)
								.execute();
						}
					}

					return results;
				});
		}),
	/**
	 * Delete an intention by its `id`.
	 * Also removes its outcome associations and any outcome left with no intentions.
	 * @param input - `id` of the intention to delete.
	 * @returns A `DeleteResult` object.
	 * @throws {NoResultError} If no intention with the provided `id` exists.
	 */
	delete: procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					// Check if the intention exists
					await trx
						.selectFrom('intentions')
						.select('id')
						.where('id', '=', input)
						.executeTakeFirstOrThrow();

					// outcomeIds linked to this intention; its outcomes_intentions rows
					// cascade away with the delete below
					const outcomeIds = (
						await trx
							.selectFrom('outcomes_intentions')
							.select('outcomeId')
							.where('intentionId', '=', input)
							.execute()
					).map((row) => row.outcomeId);

					const result = await trx.deleteFrom('intentions').where('id', '=', input).execute();

					await deleteOrphanedOutcomes(trx, outcomeIds);

					return result;
				});
		})
});
