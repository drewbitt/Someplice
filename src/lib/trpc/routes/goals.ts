import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { DbInstance } from '$src/lib/db/db';
import { sql } from 'kysely';
import { z } from 'zod';
import type { Goal } from '../types';

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
	 * @param {number} input - 0 (false) or 1 (true) to return inactive or active goals respectively
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
	 * Return goals sorted by their date they were started or stopped (the last/latest date in goal_logs)
	 * @param {number} input - 0 (false) or 1 (true) to return inactive or active goals respectively
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
	 * Return goals as they were on a specific date
	 * @param {number} input.active - 0 (false) or 1 (true) to return inactive or active goals respectively
	 * @param {date} input.date - Date to return goals as they were on
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
					goals.active = ${input.active}
				AND
					DATE(goal_logs.date) = DATE(${input.date.toISOString()})
				GROUP BY
					goals.id
				ORDER BY
					date DESC
			`.execute(getDb());

			return goalsWithDate.rows;
		}),
	add: t.procedure
		.use(logger)
		.input(
			z.object({
				active: z.number(),
				title: z.string(),
				description: z.string().optional(),
				color: z.string()
			})
		)
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
						.limit(1)
						.execute();
					// If no goals, set orderNumber to 1
					const orderNumber = maxOrderNumber.length ? maxOrderNumber[0].orderNumber + 1 : 1;

					const result = await trx
						.insertInto('goals')
						.values({ ...input, orderNumber })
						.execute();

					// Insert into goal_logs after the goal is added
					if (result) {
						const date = new Date().toISOString();
						await trx
							.insertInto('goal_logs')
							.values({
								goalId: Number(result[0]?.insertId),
								type: 'start',
								date: date
							})
							.execute();
					}

					return result;
				});
		}),
	/**
	 * Update a goal in getDb() with input goal by ID
	 * @param {Goal} input - Goal to update
	 * @param {number} input.id - ID of goal to update
	 * @returns {UpdateResult}
	 * @throws {NoResultError} If no goal with the provided ID exists in the database
	 */
	edit: t.procedure
		.use(logger)
		.input(GoalSchema)
		.mutation(async ({ input }) => {
			const result = await getDb()
				.updateTable('goals')
				.set(input)
				.where('id', '=', input.id)
				.executeTakeFirstOrThrow();
			return result;
		}),
	/**
	 * Update all goals in getDb() with input goals
	 * @param {Goal[]} input - Array of goals to update
	 * @returns { <QueryResult<typeof goal>> } - Array of now current goals
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
	 * Delete a goal by its ID
	 * @param {number} input - ID of the goal to delete
	 * @throws {NoResultError} If no goal with the provided ID exists in the database
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
	 * Archive a goal by its ID
	 * @param {number} input - ID of the goal to archive
	 * @throws {NoResultError} If no goal with the provided ID exists in the database
	 * @throws {Error} If the goal's orderNumber is undefined
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
						const endDate = new Date().toISOString();
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
	 * Restore a goal by its ID
	 * @param {number} input - ID of the goal to restore
	 * @throws {Error} If no goal with the provided ID exists in the database
	 * @throws {Error} If the goal is already active
	 */
	restore: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await getDb()
				.transaction()
				.execute(async (trx) => {
					// Retrieve goal to be restored
					const restoreGoal = await trx
						.selectFrom('goals')
						.select(['orderNumber', 'active'])
						.where('id', '=', input)
						.executeTakeFirstOrThrow();

					if (restoreGoal?.active === 1) {
						throw new Error('RESTORE_GOAL_ERROR: Goal is already active');
					}

					// Get max orderNumber from active goals
					const maxOrderNumber = await trx
						.selectFrom('goals')
						.select('orderNumber')
						.where('active', '=', 1)
						.orderBy('orderNumber', 'desc')
						.limit(1)
						.execute();

					const restoredOrderNumber = maxOrderNumber.length ? maxOrderNumber[0].orderNumber + 1 : 1;

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
								date: new Date().toISOString()
							})
							.execute();
					}

					return result;
				});
		})
});
