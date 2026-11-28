import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';
import type { PageServerLoad } from './$types';

export const load = ((event) =>
	trpcLoad(event, async (caller) => {
		const [{ window, oldestLoadedDate }, priorities, goals] = await Promise.all([
			caller.journey.page(),
			caller.priorities.list({ activeOnly: true }),
			caller.goals.list(1)
		]);
		return { ...window, oldestLoadedDate, priorities, goals };
	})) satisfies PageServerLoad;
