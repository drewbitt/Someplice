import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: trpcLoad(event, (t) => t.goals.list()),
	inactiveGoals: trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0)),
	goalLogs: trpcLoad(event, (t) => t.goal_logs.getAll())
});
