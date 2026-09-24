import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { getDb } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Transaction } from 'kysely';
import type { DB } from '$src/lib/types/data';
import type { Goal } from '../types';
import { deleteOrphanedOutcomes } from '$src/lib/db/queries';
import { adjustToUTCStartAndEndOfDay, localeCurrentDate } from '$src/lib/utils';
import { TRPCError } from '@trpc/server';

const MAX_GOALS = 9;

async function activeGoalCount(trx: Transaction<DB>): Promise<number> {
	const result = await trx
		.selectFrom('goals')
		.select((eb) => eb.fn.countAll().as('count'))
		.where('active', '=', 1)
		.executeTakeFirstOrThrow();
	return Number(result.count);
}

/**
 * Insert a goal as active and write its 'start' goal_log.
 */
async function insertGoal(trx: Transaction<DB>, goal: Omit<Goal, 'id' | 'active'>, now: string) {
	const result = await trx
		.insertInto('goals')
		.values({ ...goal, active: 1 })
		.returning('id')
		.executeTakeFirstOrThrow();

	await trx
		.insertInto('goal_logs')
		.values({
			goalId: result.id as number,
			type: 'start',
			date: now,
			orderNumber: goal.orderNumber
		})
		.execute();

	return result;
}

/**
 * Shift every active goal positioned after `orderNumber` down by one and log
 * each shift, closing the gap left by a deleted or archived goal.
 */
async function compactActiveGoalsAfter(trx: Transaction<DB>, orderNumber: number, now: string) {
	const goalsToUpdate = await trx
		.selectFrom('goals')
		.selectAll()
		.where('orderNumber', '>', orderNumber)
		.where('active', '=', 1)
		.orderBy('orderNumber', 'asc')
		.execute();

	for (const goal of goalsToUpdate) {
		const newOrderNumber = goal.orderNumber - 1;
		await trx
			.updateTable('goals')
			.set({ orderNumber: newOrderNumber })
			.where('id', '=', goal.id)
			.execute();
		await insertReorderLog(trx, goal.id as number, goal, newOrderNumber, now);
	}
}

export const GoalSchema = z.object({
	id: z.number().nullable(),
	active: z.number(),
	orderNumber: z.number(),
	title: z.string(),
	description: z.string().nullable(),
	color: z.string()
});

export const goals = t.router({
	/**
	 * Return a list of goals either active or inactive.
	 * @param input - 0 (false) or 1 (true) to return inactive or active goals respectively.
	 * @returns An array of `Goal` objects.
	 */
	list: t.procedure
		.use(logger)
		.input(z.number().nonnegative().lte(1).optional().default(1))
		.query<Goal[]>(
			async ({ input }) =>
				await getDb()
					.selectFrom('goals')
					.selectAll()
					.orderBy('orderNumber', 'asc')
					.where('active', '=', input)
					.execute()
		),
	/**
	 * Return goals sorted by their date they were started or stopped (the last/latest date in goal_logs).
	 * @param input - 0 (false) or 1 (true) to return inactive or active goals respectively.
	 * @returns An array of `Goal` objects.
	 */
	listGoalsSortedByDate: t.procedure
		.use(logger)
		.input(z.number().nonnegative().lte(1).optional().default(1))
		.query<Goal[]>(async ({ input }) => {
			const goalsWithDate = await sql<Goal>`
				SELECT
					goals.id,
					goals.active,
					COALESCE(
						(SELECT gl2.orderNumber FROM goal_logs gl2
						 WHERE gl2.goalId = goals.id
						 ORDER BY gl2.date DESC, gl2.id DESC LIMIT 1),
						goals.orderNumber
					) AS orderNumber,
					goals.title,
					goals.description,
					goals.color,
					MAX(goal_logs.date) as date
				FROM
					goals
				INNER JOIN
					goal_logs ON goals.id = goal_logs.goalId
				WHERE
					goals.active = ${input}
				AND
					(goal_logs.type = 'start' OR goal_logs.type = 'end')
				GROUP BY
					goals.id
				ORDER BY
					date DESC
			`.execute(getDb());

			return goalsWithDate.rows;
		}),
	/**
	 * Return goals as they were on a specific date.
	 * @param input.active - 0 (false) or 1 (true) to return inactive or active goals respectively.
	 * @param input.date - Date to return goals as they were on.
	 * @returns An array of `Goal` objects.
	 */
	listGoalsOnDate: t.procedure
		.use(logger)
		.input(
			z.object({
				active: z.number().nonnegative().lte(1).optional().default(1),
				date: z.date()
			})
		)
		.query(async ({ input }) => {
			const { endDate } = adjustToUTCStartAndEndOfDay(input.date, input.date);

			if (input.active === 1) {
				const activeGoalsWithDate = await sql<Goal>`
				SELECT
					goals.id,
					goals.active,
					COALESCE(
						(SELECT gl2.orderNumber FROM goal_logs gl2
						 WHERE gl2.goalId = goals.id AND gl2.type IN ('start', 'reorder')
						 AND gl2.date <= ${endDate.toISOString()}
						 ORDER BY gl2.date DESC, gl2.id DESC LIMIT 1),
						goals.orderNumber
					) AS orderNumber,
					goals.title,
					goals.description,
					goals.color,
					MAX(goal_logs.date) as date
				FROM
					goals
				INNER JOIN
					goal_logs ON goals.id = goal_logs.goalId
				WHERE
					goal_logs.date <= ${endDate.toISOString()}
				AND
					goal_logs.type = 'start'
				AND
					NOT EXISTS (
						SELECT 1 
						FROM goal_logs AS g2 
						WHERE g2.goalId = goals.id 
						AND g2.type = 'end' 
						AND g2.date BETWEEN goal_logs.date AND ${endDate.toISOString()}
					)
				GROUP BY
					goals.id
				ORDER BY
					orderNumber ASC
			`.execute(getDb());

				return activeGoalsWithDate.rows;
			} else {
				// Gets latest goal_log for each goal and ensures it is 'end'
				const inactiveGoalsOnDate = await sql<Goal>`
					SELECT
						goals.id,
						COALESCE(goal_logs.orderNumber, goals.orderNumber) AS orderNumber,
						goals.title,
						goals.description,
						goals.color
					FROM
						goals
					INNER JOIN
						goal_logs ON goals.id = goal_logs.goalId
					WHERE
						goal_logs.date = (
							SELECT MAX(date) 
							FROM goal_logs 
							WHERE goalId = goals.id AND date <= ${endDate.toISOString()}
						)
					AND
						goal_logs.type = 'end'
					ORDER BY
						COALESCE(goal_logs.orderNumber, goals.orderNumber) ASC
				`.execute(getDb());

				return inactiveGoalsOnDate.rows;
			}
		}),
	/**
	 * Add a new goal to the database.
	 * @param input - Goal to add, omitting `id` and `orderNumber`.
	 * @throws {NoResultError} - if there was a problem inserting the goal.
	 * @throws {Error} - if the maximum number of goals was reached.
	 * @returns An object containing the `id` of the goal inserted.
	 */
	add: t.procedure
		.use(logger)
		.input(GoalSchema.omit({ id: true, orderNumber: true }))
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const count = await activeGoalCount(trx);
					if (count >= MAX_GOALS) {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message:
								'You have reached the maximum number of 9 goals. Delete or archive a goal first.'
						});
					}

					const orderNumber = count + 1;

					// added goals are always active; archive/restore manage `active` elsewhere
					return await insertGoal(
						trx,
						{ ...input, orderNumber },
						localeCurrentDate().toISOString()
					);
				});
		}),
	/**
	 * Update all goals in the database with an array of `Goal` objects.
	 * @param input.goals - Array of `Goal` objects to update.
	 * @returns An array of now current `Goal` objects.
	 */
	updateGoals: t.procedure
		.use(logger)
		.input(
			z.object({
				// `active` is lifecycle-managed via archive/restore and is not editable here
				goals: z.array(GoalSchema.omit({ active: true }))
			})
		)
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const existingGoals = await trx
						.selectFrom('goals')
						.select(['id', 'orderNumber', 'active'])
						.execute();
					const existingById = new Map(existingGoals.map((g) => [g.id, g]));

					const updates = input.goals.filter((goal) => goal.id !== null);
					const inserts = input.goals.filter((goal) => goal.id === null);

					// New goals are always active; reject payloads that would exceed the goal cap
					if (existingGoals.filter((g) => g.active === 1).length + inserts.length > MAX_GOALS) {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message:
								'You have reached the maximum number of 9 goals. Delete or archive a goal first.'
						});
					}

					// The partial unique index on goals.orderNumber can't be deferred, so a
					// permutation update (e.g. swapping two goals' positions) would collide
					// mid-way. Move the affected rows to a scratch range first, then apply
					// the final values.
					if (updates.length > 0) {
						await trx
							.updateTable('goals')
							.set({
								orderNumber: sql`"orderNumber" + ((SELECT COALESCE(MAX("orderNumber"), 0) FROM "goals") + 1)`
							})
							.where(
								'id',
								'in',
								updates.map((goal) => goal.id as number)
							)
							.execute();
					}

					const results = [];
					const now = localeCurrentDate().toISOString();

					for (const goal of updates) {
						const existing = existingById.get(goal.id as number);
						if (!existing) {
							throw new NoResultError(
								trx
									.selectFrom('goals')
									.selectAll()
									.where('id', '=', goal.id as number)
									.toOperationNode()
							);
						}
						results.push(
							await trx
								.updateTable('goals')
								.set({
									orderNumber: goal.orderNumber,
									title: goal.title,
									description: goal.description,
									color: goal.color
								})
								.where('id', '=', goal.id)
								.execute()
						);
						await insertReorderLog(trx, goal.id as number, existing, goal.orderNumber);
					}

					for (const goal of inserts) {
						results.push(
							await insertGoal(
								trx,
								{
									orderNumber: goal.orderNumber,
									title: goal.title,
									description: goal.description,
									color: goal.color
								},
								now
							)
						);
					}

					return results;
				});
		}),
	/**
	 * Delete a goal by its `id`.
	 * Handles deleting associated intentions and outcomes.
	 * @param input - `id` of the goal to delete.
	 * @throws {NoResultError} If no goal with the provided `id` exists in the database.
	 * @returns A `DeleteResult` object.
	 */
	delete: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					// Check if goal exists and capture its position for gap compaction
					const goalToDelete = await trx
						.selectFrom('goals')
						.select(['id', 'active', 'orderNumber'])
						.where('id', '=', input)
						.executeTakeFirstOrThrow();

					// Collect the outcomeIds linked to this goal's intentions before deleting;
					// the intentions / outcomes_intentions / goal_logs rows cascade away with the goal
					const associatedOutcomeIds = (
						await trx
							.selectFrom('outcomes_intentions')
							.innerJoin('intentions', 'intentions.id', 'outcomes_intentions.intentionId')
							.select('outcomeId')
							.where('intentions.goalId', '=', input)
							.execute()
					).map((row) => row.outcomeId);

					const result = await trx.deleteFrom('goals').where('id', '=', input).execute();

					// close the gap left by an active goal and log each shift, mirroring archive
					if (goalToDelete.active === 1) {
						await compactActiveGoalsAfter(
							trx,
							goalToDelete.orderNumber,
							localeCurrentDate().toISOString()
						);
					}

					await deleteOrphanedOutcomes(trx, associatedOutcomeIds);

					return result;
				});
		}),
	/**
	 * Archive a goal by its `id`.
	 * @param input - `id` of the goal to archive.
	 * @throws {NoResultError} If no goal with the provided `id` exists in the database.
	 * @throws {Error} If the goal is already archived.
	 * @returns An `UpdateResult` object.
	 */
	archive: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					// find the orderNumber of the goal that is to be archived
					const archivedGoal = await trx
						.selectFrom('goals')
						.select(['orderNumber', 'active'])
						.where('id', '=', input)
						.executeTakeFirstOrThrow();
					if (archivedGoal.active === 0) {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message: 'Goal is already archived.'
						});
					}
					const archivedGoalOrder = archivedGoal.orderNumber;

					// set the archived goal as inactive and set orderNumber to 0
					const result = await trx
						.updateTable('goals')
						.set({ active: 0, orderNumber: 0 })
						.where('id', '=', input)
						.execute();

					const endDate = localeCurrentDate().toISOString();

					// close the gap and log each shift so historical queries see post-archive positions
					await compactActiveGoalsAfter(trx, archivedGoalOrder, endDate);

					// Update the goal_logs when a goal is archived
					if (result) {
						await trx
							.insertInto('goal_logs')
							.values({
								goalId: input,
								type: 'end',
								date: endDate,
								orderNumber: archivedGoalOrder
							})
							.execute();
					}

					return result;
				});
		}),
	/**
	 * Restore a goal by its `id`.
	 * @param input - `id` of the goal to restore.
	 * @returns An `UpdateResult` object.
	 * @throws {NoResultError} If no goal with the provided `id` exists in the database.
	 * @throws {Error} If the maximum number of goals has been reached.
	 * @throws {Error} If the goal is already active.
	 */
	restore: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const [count, restoreGoal] = await Promise.all([
						activeGoalCount(trx),
						trx
							.selectFrom('goals')
							.select(['orderNumber', 'active'])
							.where('id', '=', input)
							.executeTakeFirstOrThrow()
					]);

					// Can't restore if the active goal cap is reached
					if (count >= MAX_GOALS) {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message:
								'You have reached the maximum number of 9 goals. Delete or archive a goal first.'
						});
					}

					if (restoreGoal?.active === 1) {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message: 'Goal is already active.'
						});
					}

					const restoredOrderNumber = count + 1;

					// Set the restored goal as active, with orderNumber as maxOrderNumber + 1
					const result = await trx
						.updateTable('goals')
						.set({ active: 1, orderNumber: restoredOrderNumber })
						.where('id', '=', input)
						.execute();

					// Log the start of the goal
					if (result) {
						await trx
							.insertInto('goal_logs')
							.values({
								goalId: input,
								type: 'start',
								date: localeCurrentDate().toISOString(),
								orderNumber: restoredOrderNumber
							})
							.executeTakeFirst();
					}

					return result;
				});
		})
});

/**
 * Write a 'reorder' goal_log when an active goal's orderNumber changed.
 * Archived goals are not logged: their position comes from the 'end' log.
 */
async function insertReorderLog(
	trx: Transaction<DB>,
	goalId: number,
	existing: { active: number; orderNumber: number },
	newOrderNumber: number,
	date = localeCurrentDate().toISOString()
) {
	if (existing.active === 1 && existing.orderNumber !== newOrderNumber) {
		await trx
			.insertInto('goal_logs')
			.values({
				goalId,
				type: 'reorder',
				date,
				orderNumber: newOrderNumber
			})
			.execute();
	}
}
