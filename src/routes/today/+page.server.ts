import { configuredZoneNow } from '#lib/db/queries.js';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';

export const load = (async (event) => {
	const now = await configuredZoneNow();
	const startOfZoneDay = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const historyEnd = new Date(startOfZoneDay);
	historyEnd.setUTCDate(historyEnd.getUTCDate() - 1);
	const historyStart = new Date(historyEnd);
	historyStart.setUTCDate(historyStart.getUTCDate() - 2);
	const [goals, intentions, intentionsOnLatestDate, priorities, inactiveGoals, recentIntentions] =
		await Promise.all([
			trpcLoad(event, (t) => t.goals.list(1)),
			trpcLoad(event, (t) => t.intentions.list({ startDate: now, endDate: now })),
			trpcLoad(event, (t) =>
				t.intentions.intentionsOnLatestDate({ before: startOfZoneDay.toISOString() })
			),
			trpcLoad(event, (t) => t.priorities.list({ activeOnly: true })),
			// Intentions on inactive goals still render (greyed); without them the
			// day list silently hides pending rows. listGoalsSortedByDate recovers
			// the orderNumber an archived goal had (archive resets it to 0).
			trpcLoad(event, (t) => t.goals.listGoalsSortedByDate(0)),
			trpcLoad(event, (t) => t.intentions.list({ startDate: historyStart, endDate: historyEnd }))
		]);
	let hasOutstandingOutcome = false;
	if (intentionsOnLatestDate.length > 0) {
		const date = new Date(intentionsOnLatestDate[0].date);
		const outcomes = await trpcLoad(event, (t) =>
			t.outcomes.list({ startDate: date, endDate: date })
		);
		hasOutstandingOutcome = !outcomes[0]?.reviewed;
	}
	return {
		today: now.toISOString().slice(0, 10),
		goals,
		intentions,
		intentionsOnLatestDate,
		priorities,
		inactiveGoals,
		recentIntentions,
		hasOutstandingOutcome
	};
}) satisfies PageServerLoad;
