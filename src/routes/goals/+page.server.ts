import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: await trpcLoad(event, (t) => t.goals.list()),
	inactiveGoals: await trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0)),
	goalLogs: await trpcLoad(event, (t) => t.goal_logs.getAll())
});
