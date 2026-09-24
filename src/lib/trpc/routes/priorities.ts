import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { getDb } from '$src/lib/db/db';
import { NoResultError, type Selectable } from 'kysely';
import { z } from 'zod';
import type { Priorities } from '$src/lib/types/data';
import { adjustToUTCStartAndEndOfDay, localeCurrentDate } from '$src/lib/utils';

export const PrioritySchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	text: z.string(),
	description: z.string().nullable(),
	// YYYY-MM-DD check-in date, optional
	checkInDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable(),
	// ISO 8601 date strings
	createdAt: z.string(),
	completedAt: z.string().nullable(),
	reflection: z.string().nullable()
});

export const priorities = t.router({
	/**
	 * List priorities as plain generated database rows.
	 * @param input.activeOnly - When true (default), return only active priorities
	 * (`completedAt IS NULL`) — at most one per goal.
	 * @returns An array of priorities with `goalTitle`/`goalColor`/`goalOrderNumber`.
	 */
	list: t.procedure
		.use(logger)
		.input(
			z
				.object({
					activeOnly: z.boolean().optional().default(true)
				})
				.optional()
		)
		.query<Selectable<Priorities>[]>(async ({ input }) => {
			let query = getDb().selectFrom('priorities').selectAll().orderBy('goalId', 'asc');

			if (input?.activeOnly ?? true) {
				query = query.where('completedAt', 'is', null);
			}

			return await query.execute();
		}),
	/**
	 * List completed priorities (milestones), newest first.
	 * @param input.goalId - Restrict to one goal (optional).
	 * @param input.startDate - Include priorities completed on/after this date (optional).
	 * @param input.endDate - Include priorities completed on/before this date (optional).
	 * @param input.limit - Maximum number of results (optional).
	 * @param input.offset - Offset into the result set (optional).
	 * @returns An array of completed priorities with goal display fields.
	 */
	listCompleted: t.procedure
		.use(logger)
		.input(
			z
				.object({
					goalId: z.number().optional(),
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
		.query<Selectable<Priorities>[]>(async ({ input }) => {
			let query = getDb()
				.selectFrom('priorities')
				.selectAll()
				.where('completedAt', 'is not', null)
				.orderBy('completedAt', 'desc');

			if (input?.goalId) {
				query = query.where('goalId', '=', input.goalId);
			}
			if (input?.startDate && input?.endDate) {
				const { startDate, endDate } = adjustToUTCStartAndEndOfDay(input.startDate, input.endDate);
				query = query
					.where('completedAt', '>=', startDate.toISOString())
					.where('completedAt', '<=', endDate.toISOString());
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
	 * Set a new top priority for a goal. Any existing active priority for the goal is
	 * completed first (keeping the one-active-per-goal invariant); use `edit` to change
	 * the current priority in place without completing it.
	 * @param input.goalId - Goal to set the priority on.
	 * @param input.text - The priority text.
	 * @param input.description - Optional longer description.
	 * @param input.checkInDate - Optional YYYY-MM-DD check-in date.
	 * @returns An object containing the `id` of the new priority.
	 */
	upsert: t.procedure
		.use(logger)
		.input(
			PrioritySchema.pick({ goalId: true, text: true }).extend({
				text: z.string().min(1),
				description: z.string().nullable().optional(),
				checkInDate: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.optional()
			})
		)
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const now = localeCurrentDate().toISOString();

					const active = await trx
						.selectFrom('priorities')
						.select('id')
						.where('goalId', '=', input.goalId)
						.where('completedAt', 'is', null)
						.executeTakeFirst();
					if (active) {
						return await trx
							.updateTable('priorities')
							.set({
								text: input.text,
								description: input.description ?? null,
								checkInDate: input.checkInDate ?? null
							})
							.where('id', '=', active.id)
							.returning('id')
							.executeTakeFirstOrThrow();
					}

					return await trx
						.insertInto('priorities')
						.values({
							goalId: input.goalId,
							text: input.text,
							description: input.description ?? null,
							checkInDate: input.checkInDate ?? null,
							createdAt: now,
							completedAt: null,
							reflection: null
						})
						.returning('id')
						.executeTakeFirstOrThrow();
				});
		}),
	/**
	 * Edit an existing priority's fields in place.
	 * @param input.id - The priority to edit.
	 * @param input.text - New text (optional).
	 * @param input.description - New description (optional; pass null to clear).
	 * @param input.checkInDate - New check-in date (optional; pass null to clear).
	 * @returns An `UpdateResult` object.
	 * @throws {NoResultError} If no priority with the provided `id` exists.
	 */
	edit: t.procedure
		.use(logger)
		.input(
			z.object({
				id: z.number(),
				text: z.string().min(1).optional(),
				description: z.string().nullable().optional(),
				checkInDate: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.nullable()
					.optional()
			})
		)
		.mutation(async ({ input }) => {
			const query = getDb()
				.updateTable('priorities')
				.set({
					...(input.text !== undefined ? { text: input.text } : {}),
					...(input.description !== undefined ? { description: input.description } : {}),
					...(input.checkInDate !== undefined ? { checkInDate: input.checkInDate } : {})
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
	 * Complete a priority, recording when and an optional reflection. Completed
	 * priorities surface as milestones on the journey page.
	 * @param input.id - The priority to complete.
	 * @param input.reflection - Optional reflection text.
	 * @returns An `UpdateResult` object.
	 * @throws {NoResultError} If no active priority with the provided `id` exists.
	 */
	complete: t.procedure
		.use(logger)
		.input(
			z.object({
				id: z.number(),
				reflection: z.string().nullable().optional()
			})
		)
		.mutation(async ({ input }) => {
			const query = getDb()
				.updateTable('priorities')
				.set({
					completedAt: localeCurrentDate().toISOString(),
					reflection: input.reflection ?? null
				})
				.where('id', '=', input.id)
				.where('completedAt', 'is', null);
			const result = await query.executeTakeFirst();
			if (Number(result?.numUpdatedRows) === 0) {
				throw new NoResultError(query.toOperationNode());
			}
			return result;
		}),
	/**
	 * Clear a goal's active priority without completing it. The row is deleted so it
	 * does not appear in milestone history.
	 * @param input - `goalId` of the goal whose active priority should be removed.
	 * @returns A `DeleteResult` object.
	 */
	clear: t.procedure
		.use(logger)
		.input(z.object({ goalId: z.number() }))
		.mutation(async ({ input }) => {
			return await getDb()
				.deleteFrom('priorities')
				.where('goalId', '=', input.goalId)
				.where('completedAt', 'is', null)
				.executeTakeFirst();
		})
});
