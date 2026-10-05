import { configuredZoneNow } from '#lib/db/queries.js';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';

export const load = (async (event) => {
	const now = await configuredZoneNow();
	const [goals, intentions, intentionsOnLatestDate, priorities, inactiveGoals] = await Promise.all([
		trpcLoad(event, (t) => t.goals.list(1)),
		trpcLoad(event, (t) => t.intentions.list({ startDate: now, endDate: now })),
		trpcLoad(event, (t) => t.intentions.intentionsOnLatestDate()),
		trpcLoad(event, (t) => t.priorities.list({ activeOnly: true })),
		// Intentions on inactive goals still render (greyed); without them the
		// day list silently hides pending rows. listGoalsSortedByDate recovers
		// the orderNumber an archived goal had (archive resets it to 0).
		trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0))
	]);
	let hasOutstandingOutcome = false;
	if (intentions.length === 0 && intentionsOnLatestDate.length > 0) {
		const date = new Date(intentionsOnLatestDate[0].date);
		const outcomes = await trpcLoad(event, (t) =>
			t.outcomes.list({ startDate: date, endDate: date })
		);
		hasOutstandingOutcome = !outcomes[0]?.reviewed;
	}
	return {
		goals,
		intentions,
		intentionsOnLatestDate,
		priorities,
		inactiveGoals,
		hasOutstandingOutcome
	};
}) satisfies PageServerLoad;
