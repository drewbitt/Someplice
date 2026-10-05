import { trpcLoad } from '#lib/trpc/middleware/trpc-load.js';
import { configuredZoneNow } from '#lib/db/queries.js';
import { loadJourneyGoals } from '#lib/components/journey/windows.js';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	const limit = 15;
	const now = await configuredZoneNow();
	const { intentionsByDate, startDate, endDate: intentionsEndDate } = await getIntentionsByDate();
	// Bound by wall-clock "now" in the configured zone, not Date.now(): stored
	// timestamps use the fake-Z convention, so a real instant compares wrong.
	const endDate = new Date(Math.max(intentionsEndDate.getTime(), now.getTime()));
	// Outcomes are windowed with the day set (as in loadMore) so outcome-only
	// days inside the window arrive with the first page.
	const [outcomes, priorities, completedPriorities, goals] = await Promise.all([
		trpcLoad(event, (t) => t.outcomes.list({ startDate, endDate, order: 'desc', orderBy: 'date' })),
		trpcLoad(event, (t) => t.priorities.list({ activeOnly: true })),
		trpcLoad(event, (t) => t.priorities.listCompleted({ startDate, endDate })),
		trpcLoad(event, (t) => t.goals.list(1))
	]);
	const verdicts = await trpcLoad(event, (t) =>
		t.outcomes.verdictsByOutcomeIds({
			outcomeIds: outcomes.map((outcome) => outcome.id).filter((id): id is number => id !== null)
		})
	);
	const goalsByDate = await loadJourneyGoals(
		{ intentionsByDate, outcomes, verdicts, completedPriorities },
		(date) =>
			Promise.all([
				trpcLoad(event, (t) => t.goals.listGoalsOnDate({ date })),
				trpcLoad(event, (t) => t.goals.listGoalsOnDate({ active: 0, date }))
			])
	);

	return {
		goals,
		intentionsByDate,
		goalsByDate,
		outcomes,
		verdicts,
		priorities,
		completedPriorities,
		oldestLoadedDate: startDate.toISOString().slice(0, 10)
	};

	async function getIntentionsByDate() {
		const uniqueDatesResult = await trpcLoad(event, (t) => t.intentions.listUniqueDates({ limit }));
		let uniqueDates = uniqueDatesResult.map((d) => d.date);
		if (uniqueDates.length === 0) {
			const [recentOutcomes, recentPriorities] = await Promise.all([
				trpcLoad(event, (t) => t.outcomes.list({ order: 'desc', orderBy: 'date', limit })),
				trpcLoad(event, (t) => t.priorities.listCompleted({ limit }))
			]);
			uniqueDates = [
				...new Set([
					...recentOutcomes.map((outcome) => outcome.date),
					...recentPriorities
						.map((priority) => priority.completedAt?.slice(0, 10))
						.filter((date): date is string => Boolean(date))
				])
			]
				.sort((a, b) => b.localeCompare(a))
				.slice(0, limit);
		}

		let endDate = new Date(uniqueDates[0]);
		let startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		// At least ensure that the dates are valid
		if (Number.isNaN(endDate.getTime())) {
			endDate = now;
		}
		if (Number.isNaN(startDate.getTime())) {
			startDate = now;
		}

		const intentionsByDate = await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate,
				endDate
			})
		);

		return { intentionsByDate, startDate, endDate };
	}
}) satisfies PageServerLoad;
