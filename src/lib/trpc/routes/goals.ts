import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { NoResultError, sql } from 'kysely';
import { z } from 'zod';
import type { Goal } from '../types';
import { localeCurrentDate } from '$src/lib/utils';

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
					.select(['id', 'active', 'orderNumber', 'title', 'description', 'color'])
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
					goals.orderNumber,
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
			const startOfDate = new Date(
				Date.UTC(input.date.getUTCFullYear(), input.date.getUTCMonth(), input.date.getUTCDate())
			);
			startOfDate.setUTCHours(0, 0, 0, 0);
			const endOfDate = new Date(
				Date.UTC(input.date.getUTCFullYear(), input.date.getUTCMonth(), input.date.getUTCDate())
			);
			endOfDate.setUTCHours(23, 59, 59, 999);

			if (input.active === 1) {
				const activeGoalsWithDate = await sql<Goal>`
				SELECT
					goals.id,
					goals.active,
					goals.orderNumber,
					goals.title,
					goals.description,
					goals.color,
					MAX(goal_logs.date) as date
				FROM
					goals
				INNER JOIN
					goal_logs ON goals.id = goal_logs.goalId
				WHERE
					goal_logs.date <= ${endOfDate.toISOString()}
				AND
					goal_logs.type = 'start'
				AND
					NOT EXISTS (
						SELECT 1 
						FROM goal_logs AS g2 
						WHERE g2.goalId = goals.id 
						AND g2.type = 'end' 
						AND g2.date BETWEEN goal_logs.date AND ${endOfDate.toISOString()}
					)
				GROUP BY
					goals.id
				ORDER BY
					goals.orderNumber ASC		
			`.execute(getDb());

				return activeGoalsWithDate.rows;
			} else {
				// Gets latest goal_log for each goal and ensures it is 'end'
				const inactiveGoalsOnDate = await sql<Goal>`
					SELECT
						goals.id,
						goals.orderNumber,
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
							WHERE goalId = goals.id AND date <= ${endOfDate.toISOString()}
						)
					AND
						goal_logs.type = 'end'
					ORDER BY
						goals.orderNumber ASC
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
						.values({ ...input, orderNumber })
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
								date: date
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
		.input(GoalSchema)
		.mutation(async ({ input }) => {
			const query = getDb().updateTable('goals').set(input).where('id', '=', input.id);
			const result = await query.executeTakeFirst();
			// executeTakeFirstOrThrow() does not work on updates where no rows are updated as nothing is returned?
			// Don't want to return the id of the updated row as we would lose UpdateResult like numUpdatedRows
			// Manual throw
			if (Number(result?.numUpdatedRows) === 0) {
				throw new NoResultError(query.toOperationNode());
			}
			return result;
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
				goals: z.array(GoalSchema)
			})
		)
		.mutation(async ({ input }) => {
			const results = await getDb()
				.transaction()
				.execute(async (trx) => {
					return await Promise.all(
						input.goals.map(async (goal) => {
							if (goal.id) {
								const result = await trx
									.updateTable('goals')
									.set(goal)
									.where('id', '=', goal.id)
									.execute();
								return result;
							} else {
								return await trx.insertInto('goals').values(goal).execute();
							}
						})
					);
				});

			return results;
		}),
	/**
	 * Delete a goal by its `id`.
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

					// Need to deal with references first

					// find the intentionIds associated with the goal
					const intentions = await trx
						.selectFrom('intentions')
						.select('id')
						.where('goalId', '=', input)
						.execute();

					// delete from outcomes_intentions table
					for (const intention of intentions) {
						await trx
							.deleteFrom('outcomes_intentions')
							.where('intentionId', '=', intention.id)
							.execute();
					}

					// delete from intentions table
					await trx.deleteFrom('intentions').where('goalId', '=', input).execute();

					// delete from goal_logs table
					await trx.deleteFrom('goal_logs').where('goalId', '=', input).execute();

					// delete from goals table
					return await trx.deleteFrom('goals').where('id', '=', input).execute();
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
						.select(['orderNumber'])
						.where('id', '=', input)
						.executeTakeFirstOrThrow();
					const archivedGoalOrder = archivedGoal?.orderNumber;
					if (!archivedGoalOrder) {
						throw new Error('ARCHIVE_GOAL_ERROR: archivedGoalOrder is undefined');
					}

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
								date: endDate
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
								date: localeCurrentDate().toISOString()
							})
							.executeTakeFirst();
					}

					return result;
				});
		})
});
