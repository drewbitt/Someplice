import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import { goalsForJourneyDay } from '$src/lib/utils';
import type { Goal } from '$src/lib/trpc/types';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;
	const outcomes = await trpcLoad(event, (t) =>
		t.outcomes.list({ limit, order: 'desc', orderBy: 'date' })
	);
	const intentionsByDate = await getIntentionsByDate();

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
		outcomes,
		verdicts: await trpcLoad(event, (t) =>
			t.outcomes.verdictsByOutcomeIds({
				outcomeIds: outcomes.map((outcome) => outcome.id).filter((id): id is number => id !== null)
			})
		)
	};

	async function getIntentionsByDate() {
		const uniqueDatesResult = await trpcLoad(event, (t) => t.intentions.listUniqueDates({ limit }));
		const uniqueDates = uniqueDatesResult.map((d) => d.date);

		let endDate = new Date(uniqueDates[0]);
		let startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		if (Number.isNaN(endDate.getTime())) {
			endDate = new Date();
		}
		if (Number.isNaN(startDate.getTime())) {
			startDate = new Date();
		}

		return await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate,
				endDate
			})
		);
	}
};
