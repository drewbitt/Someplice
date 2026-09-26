import type { Selectable } from 'kysely';
import type { Goal, Intention } from '../trpc/types';
import type { Intentions } from '../types/data';

export const INTENTION_STATUSES = ['pending', 'done', 'not_today'] as const;
export type IntentionStatus = (typeof INTENTION_STATUSES)[number];

/**
 * A raw intentions table row — works with both Kysely rows and zod-typed
 * intentions. `status` is narrowed to the enum the DB CHECK constraint
 * guarantees, so rows can flow straight into zod-validated mutations.
 */
export type IntentionRow = Omit<Selectable<Intentions>, 'status'> & {
	status: IntentionStatus;
};

export const localeCurrentDate = () => {
	return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000);
};

export const localePreviousDate = () => {
	const currentDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000);
	currentDate.setDate(currentDate.getDate() - 1); // subtract one day
	return currentDate;
};

export const adjustToUTCStartAndEndOfDay = (start: Date, end: Date) => {
	const adjustDate = (
		date: Date,
		hours: number,
		minutes: number,
		seconds: number,
		milliseconds: number
	) => {
		const newDate = new Date(
			Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
		);
		newDate.setUTCHours(hours, minutes, seconds, milliseconds);
		return newDate;
	};

	return {
		startDate: adjustDate(start, 0, 0, 0, 0),
		endDate: adjustDate(end, 23, 59, 59, 999)
	};
};

export const dayOfWeekFromDate = (date: Date) => {
	const formatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		timeZone: 'UTC'
	});
	return formatter.format(date);
};

export const lighterHSLColor = (color: string): string => {
	const [hue, saturation, lightness] = color
		.slice(4, -1)
		.split(' ')
		.map((x) => parseFloat(x));
	const lighterLightness = lightness + (100 - lightness) * 0.2;
	return `hsl(${hue},${saturation}%,${lighterLightness}%)`;
};

export const evenLighterHSLColor = (color: string): string => {
	const [hue, saturation, lightness] = color
		.slice(4, -1)
		.split(' ')
		.map((x) => parseFloat(x));
	const lighterLightness = lightness + (100 - lightness) * 0.4;
	return `hsl(${hue},${saturation}%,${lighterLightness}%)`;
};

// OK, this is getting ridiculous
export const evenEvenLighterHSLColor = (color: string): string => {
	const [hue, saturation, lightness] = color
		.slice(4, -1)
		.split(' ')
		.map((x) => parseFloat(x));
	const lighterLightness = lightness + (100 - lightness) * 0.65;
	return `hsl(${hue},${saturation}%,${lighterLightness}%)`;
};

export const goalColorForIntention = (intention: Pick<Intention, 'goalId'>, goals: Goal[]) => {
	const goal = goals.find((goal) => goal.id === intention.goalId);
	if (goal) {
		return goal.color;
	}
	return 'black';
};

export const goalOrderNumberForId = (goalId: number, goals: Goal[]) => {
	const goal = goals.find((goal) => goal.id === goalId);
	if (goal) {
		return goal.orderNumber;
	}
	return -1;
};

// A journey day needs active goals plus inactive goals that have intentions that
// day (e.g. a goal archived the same day), otherwise they render as "-1)".
export const goalsForJourneyDay = (
	active: Goal[],
	inactive: Goal[],
	intentions: Intention[]
): Goal[] => {
	const referencedGoalIds = new Set(intentions.map((intention) => intention.goalId));
	const activeIds = new Set(active.map((goal) => goal.id));
	const extra = inactive.filter(
		(goal) => goal.id !== null && referencedGoalIds.has(goal.id) && !activeIds.has(goal.id)
	);
	return [...active, ...extra].sort((a, b) => a.orderNumber - b.orderNumber);
};

/**
 * Identity for "the same item on different days": a goal plus normalized text.
 * A ` — ` suffix is dropped so an imported item's appended strategy still
 * matches its source text.
 */
export const intentionMatchKey = (goalId: number, text: string) =>
	`${goalId}|${text.split(' — ')[0].trim().toLowerCase()}`;

/**
 * Map of match key -> distinct days an intention was left pending.
 * Days (not rows) are counted so two identical entries on one day are a single miss.
 */
export const pendingMissDays = (recent: IntentionRow[]) => {
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

/**
 * How many days within `recent` an item matching `goalId`+`text` was left
 * pending — the number that drives paren inflation and the skip escalation.
 */
export const computeMissCount = (recent: IntentionRow[], goalId: number, text: string) =>
	pendingMissDays(recent).get(intentionMatchKey(goalId, text))?.size ?? 0;

export interface NotDoneGroup {
	/** Latest pending occurrence — the row displayed in the propagator. */
	representative: IntentionRow;
	/** Every pending occurrence in the window; dismiss marks all of them not_today. */
	occurrences: IntentionRow[];
	/** Distinct days the item was left pending in the window. */
	missCount: number;
}

/** Group recent pending intentions into one propagator row per goalId+text. */
export const groupNotDones = (recent: IntentionRow[]): NotDoneGroup[] => {
	const groups = new Map<
		string,
		{ representative: IntentionRow; occurrences: IntentionRow[]; days: Set<string> }
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

/**
 * Checkbox state -> status for a review save. Unchecking an explicitly
 * skipped row keeps it not_today instead of silently reverting it to pending.
 */
export const statusFromReviewCheckbox = (
	intention: IntentionRow | undefined,
	checked: boolean
): IntentionStatus =>
	checked ? 'done' : intention?.status === 'not_today' ? 'not_today' : 'pending';
