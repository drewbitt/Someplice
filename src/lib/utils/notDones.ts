import type { Intention, IntentionStatus } from '../trpc/types';

export const intentionMatchKey = (goalId: number, text: string) =>
	`${goalId}|${text
		.replace(/ ⟶ .*$/, '')
		.trim()
		.toLowerCase()}`;

// A completed copy resolves earlier attempts, but a new attempt on a later
// day starts a fresh sequence. Compare day labels, not wall-clock save times.
const unresolvedIntentions = (recent: Intention[]) => {
	const completedDays = new Map<string, string>();
	for (const intention of recent) {
		if (intention.status !== 'done') continue;
		const key = intentionMatchKey(intention.goalId, intention.text);
		const day = intention.date.slice(0, 10);
		if (day > (completedDays.get(key) ?? '')) completedDays.set(key, day);
	}
	return recent.filter(
		(intention) =>
			intention.status !== 'done' &&
			intention.date.slice(0, 10) >
				(completedDays.get(intentionMatchKey(intention.goalId, intention.text)) ?? '')
	);
};

export const pendingMissDays = (recent: Intention[]) => {
	const daysByKey = new Map<string, Set<string>>();
	for (const intention of unresolvedIntentions(recent)) {
		if (intention.status !== 'pending') continue;
		const key = intentionMatchKey(intention.goalId, intention.text);
		const days = daysByKey.get(key) ?? new Set<string>();
		days.add(intention.date.slice(0, 10));
		daysByKey.set(key, days);
	}
	return daysByKey;
};

export const computeMissCount = (recent: Intention[], goalId: number, text: string) =>
	pendingMissDays(recent).get(intentionMatchKey(goalId, text))?.size ?? 0;

export interface NotDoneGroup {
	representative: Intention;
	occurrences: Intention[];
	missCount: number;
}

export const groupNotDones = (recent: Intention[]): NotDoneGroup[] => {
	const groups = new Map<
		string,
		{ representative: Intention; occurrences: Intention[]; days: Set<string> }
	>();
	for (const intention of unresolvedIntentions(recent)) {
		const key = intentionMatchKey(intention.goalId, intention.text);
		const group = groups.get(key) ?? {
			representative: intention,
			occurrences: [],
			days: new Set<string>()
		};
		group.occurrences.push(intention);
		// A deliberate "not today" is recoverable, but isn't a missed commitment.
		if (intention.status === 'pending') group.days.add(intention.date.slice(0, 10));
		if (intention.date > group.representative.date) group.representative = intention;
		groups.set(key, group);
	}
	return [...groups.values()].map((group) => ({
		representative: group.representative,
		occurrences: group.occurrences,
		missCount: group.days.size
	}));
};

export const statusFromReviewCheckbox = (
	intention: Intention | undefined,
	checked: boolean
): IntentionStatus =>
	checked ? 'done' : intention?.status === 'not_today' ? 'not_today' : 'pending';
