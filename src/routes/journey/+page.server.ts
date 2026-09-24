import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import { goalsForJourneyDay } from '$src/lib/utils';
import type { Goal } from '$src/lib/trpc/types';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;

	const intentionsByDate = await getIntentionsByDate();

	// Keys are YYYY-MM-DD; goals shown for a day must be the goals as they were on
	// that date, not today's active set. Inactive goals that still have intentions
	// that day (e.g. archived the same day) are merged in.
	const goalsByDate = Object.fromEntries(
		await Promise.all(
			Object.keys(intentionsByDate).map(async (date) => {
				const [activeGoals, inactiveGoals] = await Promise.all([
					trpcLoad(event, (t) => t.goals.listGoalsOnDate({ date: new Date(date) })),
					trpcLoad(event, (t) => t.goals.listGoalsOnDate({ active: 0, date: new Date(date) }))
				]);
				return [
					date,
					goalsForJourneyDay(
						activeGoals,
						inactiveGoals.map((goal) => ({ ...goal, active: 0 }) as Goal),
						intentionsByDate[date]
					)
				];
			})
		)
	);

	return {
		goals: await trpcLoad(event, (t) => t.goals.list(1)),
		intentionsByDate,
		goalsByDate,
		outcomes: await trpcLoad(event, (t) =>
			t.outcomes.list({ limit: limit, order: 'desc', orderBy: 'date' })
		)
	};

	async function getIntentionsByDate() {
		const uniqueDatesResult = await trpcLoad(event, (t) =>
			t.intentions.listUniqueDates({ limit: limit })
		);
		const uniqueDates = uniqueDatesResult.map((d) => d.date);

		let endDate = new Date(uniqueDates[0]);
		let startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		// At least ensure that the dates are valid
		if (Number.isNaN(endDate.getTime())) {
			endDate = new Date();
		}
		if (Number.isNaN(startDate.getTime())) {
			startDate = new Date();
		}

		return await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);
	}
};
