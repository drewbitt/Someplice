import { logger } from '#lib/trpc/middleware/logger.js';
import { procedure, t } from '#lib/trpc/t.js';
import { getDb } from '#lib/db/db.js';
import { NoResultError, type Selectable } from 'kysely';
import { z } from 'zod';
import type { Priorities } from '#lib/types/data.js';
import { adjustToUTCStartAndEndOfDay } from '#lib/utils/index.js';
import { configuredZoneNow } from '#lib/db/queries.js';

export const PrioritySchema = z.object({
	id: z.number().nullable(),
	goalId: z.number(),
	text: z.string(),
	description: z.string().nullable(),
	checkInDate: z.iso.date().nullable(),
	createdAt: z.string(),
	completedAt: z.string().nullable(),
	reflection: z.string().nullable()
});

export const priorities = t.router({
	/** List priorities; by default, only the active priority for each goal. */
	list: procedure
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
	/** List completed priorities, newest first. */
	listCompleted: procedure
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
	/** Edit the active priority in place, or create one. Preserve milestone history. */
	upsert: procedure
		.use(logger)
		.input(
			PrioritySchema.pick({ goalId: true, text: true }).extend({
				text: z.string().min(1),
				description: z.string().nullable().optional(),
				checkInDate: PrioritySchema.shape.checkInDate.optional()
			})
		)
		.mutation(async ({ input }) => {
			const fields = {
				text: input.text,
				description: input.description ?? null,
				checkInDate: input.checkInDate ?? null
			};
			return await getDb()
				.insertInto('priorities')
				.values({
					goalId: input.goalId,
					...fields,
					createdAt: (await configuredZoneNow()).toISOString()
				})
				// Target the partial index so completed milestones remain untouched.
				.onConflict((oc) =>
					oc.column('goalId').where('completedAt', 'is', null).doUpdateSet(fields)
				)
				.returning('id')
				.executeTakeFirstOrThrow();
		}),
	/** Complete an active priority; throw NoResultError if it is missing or already completed. */
	complete: procedure
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
					completedAt: (await configuredZoneNow()).toISOString(),
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
	/** Clear the active priority without recording a milestone. */
	clear: procedure
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
