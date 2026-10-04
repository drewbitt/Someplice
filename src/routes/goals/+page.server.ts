import type { PageServerLoad } from './$types';
import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';

export const load = (async (event) => {
	const [goals, inactiveGoals, goalLogs, priorities] = await Promise.all([
		trpcLoad(event, (t) => t.goals.list()),
		trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0)),
		trpcLoad(event, (t) => t.goal_logs.getAll()),
		trpcLoad(event, (t) => t.priorities.list({ activeOnly: true }))
	]);
	return { goals, inactiveGoals, goalLogs, priorities };
}) satisfies PageServerLoad;
