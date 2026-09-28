import type { Intention, IntentionStatus } from '../trpc/types';

export const intentionMatchKey = (goalId: number, text: string) =>
	`${goalId}|${text
		.replace(/ ⟶ .*$/, '')
		.trim()
		.toLowerCase()}`;

export const pendingMissDays = (recent: Intention[]) => {
	const daysByKey = new Map<string, Set<string>>();
	for (const intention of recent) {
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
	for (const intention of recent) {
		if (intention.status !== 'pending') continue;
		const key = intentionMatchKey(intention.goalId, intention.text);
		const group = groups.get(key) ?? {
			representative: intention,
			occurrences: [],
			days: new Set<string>()
		};
		group.occurrences.push(intention);
		group.days.add(intention.date.slice(0, 10));
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
