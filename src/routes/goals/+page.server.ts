import type { PageServerLoad } from './$types';
import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';

export const load = (async (event) => {
	const [goals, inactiveGoals, priorities] = await Promise.all([
		trpcLoad(event, (t) => t.goals.list()),
		trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0)),
		trpcLoad(event, (t) => t.priorities.list({ activeOnly: true }))
	]);
	return { goals, inactiveGoals, priorities };
}) satisfies PageServerLoad;
