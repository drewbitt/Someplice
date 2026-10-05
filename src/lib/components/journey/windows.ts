import type { RouterOutputs } from '#lib/trpc/router.js';
import type { Goal } from '#lib/trpc/types.js';
import { goalsForJourneyDay } from '#lib/utils/index.js';

export interface JourneyWindow {
	intentionsByDate: RouterOutputs['intentions']['listByDate'];
	goalsByDate: Record<string, Goal[]>;
	outcomes: RouterOutputs['outcomes']['list'];
	verdicts: RouterOutputs['outcomes']['verdictsByOutcomeIds'];
	completedPriorities: RouterOutputs['priorities']['listCompleted'];
}

type JourneyRows = Omit<JourneyWindow, 'goalsByDate'>;

export function journeyDates(window: JourneyRows): string[] {
	return [
		...new Set([
			...Object.entries(window.intentionsByDate)
				.filter(([, intentions]) => intentions.length > 0)
				.map(([date]) => date),
			...window.outcomes.map((outcome) => outcome.date),
			...window.completedPriorities.flatMap((priority) =>
				priority.completedAt ? [priority.completedAt.slice(0, 10)] : []
			)
		])
	];
}

export function windowDates(window: JourneyWindow): string[] {
	return [...new Set([...Object.keys(window.intentionsByDate), ...journeyDates(window)])];
}

export async function loadJourneyGoals(
	window: JourneyRows,
	loadGoals: (date: Date) => Promise<[Goal[], Goal[]]>
): Promise<JourneyWindow['goalsByDate']> {
	const outcomeDateById = new Map(
		window.outcomes.flatMap((outcome) =>
			outcome.id === null ? [] : [[outcome.id, outcome.date] as const]
		)
	);
	return Object.fromEntries(
		await Promise.all(
			journeyDates(window).map(async (date) => {
				const [activeGoals, inactiveGoals] = await loadGoals(new Date(date));
				return [
					date,
					goalsForJourneyDay(
						activeGoals,
						inactiveGoals.map((goal) => ({ ...goal, active: 0 })),
						window.intentionsByDate[date] ?? [],
						[
							...window.verdicts
								.filter((verdict) => outcomeDateById.get(verdict.outcomeId) === date)
								.map((verdict) => verdict.goalId),
							...window.completedPriorities
								.filter((priority) => priority.completedAt?.slice(0, 10) === date)
								.map((priority) => priority.goalId)
						]
					)
				];
			})
		)
	);
}

export function omitWindowDays(window: JourneyWindow, dates: Set<string>): JourneyWindow {
	const outcomeIds = new Set(
		window.outcomes.filter((outcome) => dates.has(outcome.date)).map((outcome) => outcome.id)
	);
	return {
		intentionsByDate: Object.fromEntries(
			Object.entries(window.intentionsByDate).filter(([date]) => !dates.has(date))
		),
		goalsByDate: Object.fromEntries(
			Object.entries(window.goalsByDate).filter(([date]) => !dates.has(date))
		),
		outcomes: window.outcomes.filter((outcome) => !dates.has(outcome.date)),
		verdicts: window.verdicts.filter((verdict) => !outcomeIds.has(verdict.outcomeId)),
		completedPriorities: window.completedPriorities.filter(
			(priority) => !priority.completedAt || !dates.has(priority.completedAt.slice(0, 10))
		)
	};
}

export function mergeWindows(base: JourneyWindow, fresh: JourneyWindow): JourneyWindow {
	const remaining = omitWindowDays(base, new Set(windowDates(fresh)));
	return {
		intentionsByDate: { ...remaining.intentionsByDate, ...fresh.intentionsByDate },
		goalsByDate: { ...remaining.goalsByDate, ...fresh.goalsByDate },
		outcomes: [...remaining.outcomes, ...fresh.outcomes],
		verdicts: [...remaining.verdicts, ...fresh.verdicts],
		completedPriorities: [...remaining.completedPriorities, ...fresh.completedPriorities]
	};
}
