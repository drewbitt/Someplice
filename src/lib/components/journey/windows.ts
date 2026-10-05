import type { Goal, Intention, Outcome, OutcomeVerdict, Priority } from '#lib/trpc/types.js';

export interface DayWindow {
	intentionsByDate: Record<string, Intention[]>;
	goalsByDate: Record<string, Goal[]>;
	outcomes: Outcome[];
	verdicts: OutcomeVerdict[];
	completedPriorities: Priority[];
}

export function windowDates(window: DayWindow): string[] {
	return [
		...new Set([
			...Object.keys(window.intentionsByDate),
			...Object.keys(window.goalsByDate),
			...window.outcomes.map((outcome) => outcome.date),
			...window.completedPriorities.flatMap((priority) =>
				priority.completedAt ? [priority.completedAt.slice(0, 10)] : []
			)
		])
	];
}

export function omitWindowDays(window: DayWindow, dates: Set<string>): DayWindow {
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

export function mergeWindows(base: DayWindow, fresh: DayWindow): DayWindow {
	const remaining = omitWindowDays(base, new Set(windowDates(fresh)));
	return {
		intentionsByDate: { ...remaining.intentionsByDate, ...fresh.intentionsByDate },
		goalsByDate: { ...remaining.goalsByDate, ...fresh.goalsByDate },
		outcomes: [...remaining.outcomes, ...fresh.outcomes],
		verdicts: [...remaining.verdicts, ...fresh.verdicts],
		completedPriorities: [...remaining.completedPriorities, ...fresh.completedPriorities]
	};
}
