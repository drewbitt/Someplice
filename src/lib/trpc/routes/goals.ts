import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { db } from '$src/lib/db/db';
import { z } from 'zod';

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
		.query(({ input }) =>
			db
				.selectFrom('goals')
				.select(['id', 'active', 'orderNumber', 'title', 'description', 'color'])
				.orderBy('orderNumber', 'asc')
				.where('active', '=', input)
				.execute()
		),
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
			return await db.transaction().execute(async (trx) => {
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
	 * Update a goal in DB with input goal by ID
	 * @param {Goal} input - Goal to update
	 * @param {number} input.id - ID of goal to update
	 * @returns {UpdateResult[]}
	 */
	edit: t.procedure
		.use(logger)
		.input(GoalSchema)
		.mutation(async ({ input }) => {
			return await db.updateTable('goals').set(input).where('id', '=', input.id).execute();
		}),
	/**
	 * Update all goals in DB with input goals
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
			const results = await db.transaction().execute(async (trx) => {
				return await Promise.all(
					input.goals.map((goal) => {
						if (goal.id) {
							return trx.updateTable('goals').set(goal).where('id', '=', goal.id).execute();
						} else {
							return trx.insertInto('goals').values(goal).execute();
						}
					})
				);
			});

			return results;
		}),
	delete: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await db.transaction().execute(async (trx) => {
				// delete from intentions table
				await trx.deleteFrom('intentions').where('goalId', '=', input).execute();

				// delete from goals table
				return await trx.deleteFrom('goals').where('id', '=', input).execute();
			});
		}),
	archive: t.procedure
		.use(logger)
		.input(z.number())
		.mutation(async ({ input }) => {
			return await db.transaction().execute(async (trx) => {
				// find the orderNumber of the goal that is to be archived
				const archivedGoal = await trx
					.selectFrom('goals')
					.select(['orderNumber'])
					.where('id', '=', input)
					.executeTakeFirst();
				const archivedGoalOrder = archivedGoal?.orderNumber;
				if (!archivedGoalOrder) {
					throw new Error('ARCHIVE_GOAL_ERROR: archivedGoalOrder is undefined');
				}

				// set the archived goal as inactive
				const result = await trx
					.updateTable('goals')
					.set({ active: 0 })
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
				const updatePromises = goalsToUpdate.map((goal, i) =>
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
		})
});
