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
	const { intentionsByDate, startDate, endDate: intentionsEndDate } = await getIntentionsByDate();
	const endDate = new Date(Math.max(intentionsEndDate.getTime(), Date.now()));
	const priorities = await trpcLoad(event, (t) => t.priorities.list({ activeOnly: true }));
	const completedPriorities = await trpcLoad(event, (t) =>
		t.priorities.listCompleted({ startDate, endDate })
	);
	const verdicts = await trpcLoad(event, (t) =>
		t.outcomes.verdictsByOutcomeIds({
			outcomeIds: outcomes.map((outcome) => outcome.id).filter((id): id is number => id !== null)
		})
	);
	const outcomeDateById = new Map(
		outcomes
			.filter((outcome): outcome is typeof outcome & { id: number } => outcome.id !== null)
			.map((outcome) => [outcome.id, outcome.date])
	);

	// Keys are YYYY-MM-DD; goals shown for a day must be the goals as they were on
	// that date, not today's active set. Inactive goals that still have intentions
	// that day (e.g. archived the same day) are merged in.
	const goalsByDate = Object.fromEntries(
		await Promise.all(
			[
				...new Set([
					...Object.keys(intentionsByDate),
					...completedPriorities
						.map((priority) => priority.completedAt?.slice(0, 10))
						.filter((date): date is string => Boolean(date))
				])
			].map(async (date) => {
				const [activeGoals, inactiveGoals] = await Promise.all([
					trpcLoad(event, (t) => t.goals.listGoalsOnDate({ date: new Date(date) })),
					trpcLoad(event, (t) => t.goals.listGoalsOnDate({ active: 0, date: new Date(date) }))
				]);
				return [
					date,
					goalsForJourneyDay(
						activeGoals,
						inactiveGoals.map((goal) => ({ ...goal, active: 0 }) as Goal),
						intentionsByDate[date] ?? [],
						[
							...verdicts
								.filter((verdict) => outcomeDateById.get(verdict.outcomeId) === date)
								.map((verdict) => verdict.goalId),
							...completedPriorities
								.filter((priority) => priority.completedAt?.slice(0, 10) === date)
								.map((priority) => priority.goalId)
						]
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
		verdicts,
		priorities,
		completedPriorities
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

		const intentionsByDate = await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);

		return { intentionsByDate, startDate, endDate };
	}
};
