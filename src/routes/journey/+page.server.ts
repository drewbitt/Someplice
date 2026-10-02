import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';
import { configuredZoneNow } from '#lib/db/queries.js';
import { goalsForJourneyDay } from '#lib/utils/index.js';
import type { Goal } from '#lib/trpc/types.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;
	const { intentionsByDate, startDate, endDate: intentionsEndDate } = await getIntentionsByDate();
	// Bound by wall-clock "now" in the configured zone, not Date.now(): stored
	// timestamps use the fake-Z convention, so a real instant compares wrong.
	const endDate = new Date(
		Math.max(intentionsEndDate.getTime(), (await configuredZoneNow()).getTime())
	);
	// Outcomes are windowed with the day set (as in loadMore) so outcome-only
	// days inside the window arrive with the first page.
	const outcomes = await trpcLoad(event, (t) =>
		t.outcomes.list({ startDate, endDate, order: 'desc', orderBy: 'date' })
	);
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
					...outcomes.map((outcome) => outcome.date),
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
		completedPriorities,
		oldestLoadedDate: startDate.toISOString().slice(0, 10)
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
