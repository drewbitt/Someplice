import type { Goal, Intention } from '../trpc/types';

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

// Today's label domain is the browser-local wall clock: during UTC/local
// overlap hours the UTC weekday is a day off from what the user means.
export const localeDayOfWeek = () =>
	new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

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

// Theme text over an arbitrary goal color is unreadable whenever the color is
// close to the theme background; pick a fixed light/dark foreground instead.
// Parses hsl(...) and #rrggbb; anything else falls back to dark text.
export const readableTextColor = (color: string): string => {
	const lightness = colorLightness(color);
	if (lightness === null) return 'hsl(0, 0%, 12%)';
	return lightness > 0.55 ? 'hsl(0, 0%, 12%)' : 'hsl(0, 0%, 97%)';
};

const colorLightness = (color: string): number | null => {
	const hslMatch = color.trim().match(/^hsl\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?\s*\)$/i);
	if (hslMatch) return parseFloat(hslMatch[3]) / 100;
	const hexMatch = color.trim().match(/^#?([0-9a-f]{6})$/i);
	if (hexMatch) {
		const value = parseInt(hexMatch[1], 16);
		const r = (value >> 16) & 0xff;
		const g = (value >> 8) & 0xff;
		const b = value & 0xff;
		return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	}
	return null;
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
