import { logger } from '$lib/trpc/middleware/logger';
import { t } from '$lib/trpc/t';
import { z } from 'zod';
import { db } from '$src/lib/db/db';
import { OnConflictUpdateBuilder, sql } from 'kysely';

const GoalSchema = z.object({
	id: z.number(),
	active: z.number(),
	orderNumber: z.number(),
	title: z.string(),
	description: z.string().nullable(),
	color: z.string()
});

export const goals = t.router({
	list: t.procedure
		.use(logger)
		// Input if want to return only active goals
		.input(z.number().nonnegative().lte(1).optional().default(0))
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
			// get orderNumber by getting the max orderNumber and adding 1
			// Could make this a trigger in kysely with raw sql
			const maxOrderNumber = await db
				.selectFrom('goals')
				.select('orderNumber')
				.orderBy('orderNumber', 'desc')
				.limit(1)
				.execute();
			// If no goals, set orderNumber to 1
			const orderNumber = maxOrderNumber.length ? maxOrderNumber[0].orderNumber + 1 : 1;

			await db
				.insertInto('goals')
				.values({ ...input, orderNumber })
				.execute();
		}),
	edit: t.procedure
		.use(logger)
		.input(GoalSchema)
		.mutation(async ({ input }) => {
			const update = await db.updateTable('goals').set(input).where('id', '=', input.id).execute();

			if (update) {
				console.log('Updated goal');
			}
		}),
	updateGoals: t.procedure
		.use(logger)
		.input(
			z.object({
				goals: z.array(GoalSchema)
			})
		)
		.mutation(async ({ input }) => {
			/* 
			Update order numbers

			Use INSERT OR REPLACE to get around swaps of UNIQUE constraints throwing errors
			in sequential updates
			*/
			const update = await db.transaction().execute(async (trx) => {
				return await Promise.all(
					input.goals.map(async (goal) => {
						// Requires all input goals to have all fields set, else defaults will be used
						return await sql`INSERT OR REPLACE INTO goals (id, active, orderNumber, title, description, color)
										 VALUES (${goal.id}, ${goal.active}, ${goal.orderNumber}, ${goal.title},
										${goal.description}, ${goal.color})`.execute(trx);
					})
				);
			});

			if (update) {
				console.log('Updated goals orderNumbers');
			}
		})
});
