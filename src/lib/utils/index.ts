import 'culori/css';
import { parse, wcagContrast } from 'culori/fn';
import type { Goal, Intention } from '../trpc/types';

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

/**
 * The instant's wall-clock fields in `timeZone`, expressed as a Date whose
 * UTC components equal those fields (the codebase's fake-Z convention:
 * `toISOString()` reads back the zone-local wall time).
 */
export const wallClockInZone = (timeZone: string, instant: Date = new Date()): Date => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(instant);
	const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return new Date(
		Date.UTC(
			part('year'),
			part('month') - 1,
			part('day'),
			part('hour'),
			part('minute'),
			part('second'),
			instant.getMilliseconds()
		)
	);
};

/** `YYYY-MM-DD` day key for the instant in `timeZone`. */
export const dateKeyInZone = (timeZone: string, instant: Date = new Date()): string =>
	wallClockInZone(timeZone, instant).toISOString().slice(0, 10);

/** `YYYY-MM-DD` key for the day before `dateKey` (pure label math). */
export const previousDateKey = (dateKey: string): string => {
	const day = new Date(`${dateKey}T00:00:00.000Z`);
	day.setUTCDate(day.getUTCDate() - 1);
	return day.toISOString().slice(0, 10);
};

/** Long weekday name for the instant in `timeZone`. */
export const dayOfWeekInZone = (timeZone: string, instant: Date = new Date()): string =>
	new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(instant);

export const lightenHSL = (color: string, amount: number): string => {
	const [hue, saturation, lightness] = color
		.slice(4, -1)
		.split(' ')
		.map((x) => parseFloat(x));
	const lighterLightness = lightness + (100 - lightness) * amount;
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

// Pick the higher-contrast foreground for a solid goal-color fill.
export const readableTextColor = (color: string): string => {
	const background = parse(color.trim().toLowerCase());
	const dark = 'black';
	const light = 'white';
	if (!background) return dark;
	return wcagContrast(background, dark) >= wcagContrast(background, light) ? dark : light;
};

// A journey day needs active goals plus inactive goals that have intentions that
// day (e.g. a goal archived the same day), otherwise they render as "-1)".
export const goalsForJourneyDay = (
	active: Goal[],
	inactive: Goal[],
	intentions: Intention[],
	extraGoalIds: Iterable<number> = []
): Goal[] => {
	const referencedGoalIds = new Set(intentions.map((intention) => intention.goalId));
	for (const goalId of extraGoalIds) {
		referencedGoalIds.add(goalId);
	}
	const activeIds = new Set(active.map((goal) => goal.id));
	const extra = inactive.filter(
		(goal) => goal.id !== null && referencedGoalIds.has(goal.id) && !activeIds.has(goal.id)
	);
	return [...active, ...extra].sort((a, b) => a.orderNumber - b.orderNumber);
};
