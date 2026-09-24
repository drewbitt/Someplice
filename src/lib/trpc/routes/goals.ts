import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Transaction } from 'kysely';
import type { DB } from '$src/lib/types/data';
import type { Goal } from '../types';
import { adjustToUTCStartAndEndOfDay, localeCurrentDate } from '$src/lib/utils';

const getDb = () => DbInstance.getInstance().db;

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
					// get orderNumber by getting the max orderNumber and adding 1
					// Could make this a trigger in kysely with raw sql
					const maxOrderNumber = await trx
						.selectFrom('goals')
						.select('orderNumber')
						.orderBy('orderNumber', 'desc')
						.executeTakeFirst()
						.then((res) => res?.orderNumber)
						// catch is not needed
						.catch((err) => {
							throw new Error(err);
						});

					if (maxOrderNumber && maxOrderNumber >= 9) {
						throw new Error(`You have reached the maximum number of 9 goals. 
						Please delete or archive a goal to add a new one.`);
					}

					// If no goals, set orderNumber to 1
					const orderNumber = maxOrderNumber ? maxOrderNumber + 1 : 1;

					const result = await trx
						.insertInto('goals')
						// added goals are always active; archive/restore manage `active` elsewhere
						.values({ ...input, active: 1, orderNumber })
						.returning('id')
						.executeTakeFirstOrThrow();

					// Insert into goal_logs after the goal is added
					if (result.id) {
						const date = localeCurrentDate().toISOString();
						await trx
							.insertInto('goal_logs')
							.values({
								goalId: result.id,
								type: 'start',
								date: date,
								orderNumber: orderNumber
							})
							.returning('id')
							.executeTakeFirstOrThrow();
					}

					return result;
				});
		}),
	/**
	 * Update a goal in the database with a given `Goal` object by `id`.
	 * @param input - `Goal` object to update.
	 * @param input.id - ID of the goal to update.
	 * @returns An `UpdateResult` object.
	 * @throws {NoResultError} If no goal with the provided `id` exists in the database.
	 */
	edit: t.procedure
		.use(logger)
		// `active` is lifecycle-managed via archive/restore and is not editable here
		.input(GoalSchema.omit({ active: true }))
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					const existing = await trx
						.selectFrom('goals')
						.select(['active', 'orderNumber'])
						.where('id', '=', input.id)
						.executeTakeFirstOrThrow();

					const query = trx
						.updateTable('goals')
						.set({
							orderNumber: input.orderNumber,
							title: input.title,
							description: input.description,
							color: input.color
						})
						.where('id', '=', input.id);
					const result = await query.executeTakeFirst();
					// executeTakeFirstOrThrow() does not work on updates where no rows are updated as nothing is returned?
					// Don't want to return the id of the updated row as we would lose UpdateResult like numUpdatedRows
					// Manual throw
					if (Number(result?.numUpdatedRows) === 0) {
						throw new NoResultError(query.toOperationNode());
					}

					await insertReorderLog(trx, input.id as number, existing, input.orderNumber);

					return result;
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
					if (existingGoals.filter((g) => g.active === 1).length + inserts.length > 9) {
						throw new Error(`You have reached the maximum number of 9 goals. 
						Please delete or archive a goal to add a new one.`);
					}

					// The partial unique index on goals.orderNumber can't be deferred, so a
					// permutation update (e.g. swapping two goals' positions) would collide
					// mid-way. Move the affected rows to a scratch range first, then apply
					// the final values.
					if (updates.length > 0) {
						await trx
							.updateTable('goals')
							.set({ orderNumber: sql`"orderNumber" + 100000` })
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
						const result = await trx
							.insertInto('goals')
							.values({
								active: 1,
								orderNumber: goal.orderNumber,
								title: goal.title,
								description: goal.description,
								color: goal.color
							})
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
						results.push(result);
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
					// Check if goal exists
					await trx
						.selectFrom('goals')
						.select('id')
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

					// Delete outcomes left with no associated intentions
					for (const outcomeId of new Set(associatedOutcomeIds)) {
						const intentionsCount = await trx
							.selectFrom('outcomes_intentions')
							.select(({ fn }) => [fn.countAll<number>().as('count')])
							.where('outcomeId', '=', outcomeId)
							.executeTakeFirstOrThrow();

						if (Number(intentionsCount.count) === 0) {
							await trx.deleteFrom('outcomes').where('id', '=', outcomeId).execute();
						}
					}

					return result;
				});
		}),
	/**
	 * Archive a goal by its `id`.
	 * @param input - `id` of the goal to archive.
	 * @throws {NoResultError} If no goal with the provided `id` exists in the database.
	 * @throws {Error} If the goal's `orderNumber` is undefined.
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
						throw new Error('ARCHIVE_GOAL_ERROR: goal is already archived');
					}
					const archivedGoalOrder = archivedGoal.orderNumber;

					// set the archived goal as inactive and set orderNumber to 0
					const result = await trx
						.updateTable('goals')
						.set({ active: 0, orderNumber: 0 })
						.where('id', '=', input)
						.execute();

					// get all active goals with orderNumber greater than the archived one
					const goalsToUpdate = await trx
						.selectFrom('goals')
						.select(['id', 'orderNumber'])
						.where('orderNumber', '>', archivedGoalOrder)
						.where('active', '=', 1)
						.orderBy('orderNumber', 'asc')
						.execute();

					// decrement the orderNumber of each goal sequentially
					const updatePromises = goalsToUpdate.map((goal) =>
						trx
							.updateTable('goals')
							.set({ orderNumber: goal.orderNumber - 1 })
							.where('id', '=', goal.id)
							.execute()
					);
					await Promise.all(updatePromises);

					// Update the goal_logs when a goal is archived
					if (result) {
						const endDate = localeCurrentDate().toISOString();
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
					// Retrieve the max order number and the goal to be restored in a single query
					const [maxOrderResult, restoreGoal] = await Promise.all([
						trx
							.selectFrom('goals')
							.select('orderNumber')
							.orderBy('orderNumber', 'desc')
							.executeTakeFirst(),
						trx
							.selectFrom('goals')
							.select(['orderNumber', 'active'])
							.where('id', '=', input)
							.executeTakeFirstOrThrow()
					]);

					const maxOrderNumber = maxOrderResult?.orderNumber;

					// Can't restore if there are already 9 goals
					if (maxOrderNumber && maxOrderNumber >= 9) {
						throw new Error(`You have reached the maximum number of 9 goals. 
						Please delete or archive a goal first to restore a goal.`);
					}

					if (restoreGoal?.active === 1) {
						throw new Error('RESTORE_GOAL_ERROR: Goal is already active');
					}

					const restoredOrderNumber = maxOrderNumber ? maxOrderNumber + 1 : 1;

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
	newOrderNumber: number
) {
	if (existing.active === 1 && existing.orderNumber !== newOrderNumber) {
		await trx
			.insertInto('goal_logs')
			.values({
				goalId,
				type: 'reorder',
				date: localeCurrentDate().toISOString(),
				orderNumber: newOrderNumber
			})
			.execute();
	}
}
