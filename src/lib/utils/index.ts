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

type Rgb = [number, number, number];

// Parses hsl(...) and #rrggbb; returns null for anything else.
const colorToRgb = (color: string): Rgb | null => {
	const hsl = color.trim().match(/^hsl\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?\s*\)$/i);
	if (hsl) {
		const h = parseFloat(hsl[1]);
		const s = parseFloat(hsl[2]) / 100;
		const l = parseFloat(hsl[3]) / 100;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		const [r, g, b] =
			h < 60
				? [c, x, 0]
				: h < 120
					? [x, c, 0]
					: h < 180
						? [0, c, x]
						: h < 240
							? [0, x, c]
							: h < 300
								? [x, 0, c]
								: [c, 0, x];
		return [r, g, b].map((v) => Math.round((v + m) * 255)) as Rgb;
	}
	const hex = color.trim().match(/^#?([0-9a-f]{6})$/i);
	if (!hex) return null;
	const v = parseInt(hex[1], 16);
	return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

// WCAG 2.x relative luminance and contrast ratio.
const luminance = ([r, g, b]: Rgb): number => {
	const linear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrastRatio = (a: Rgb, b: Rgb): number =>
	(Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

// Theme text over an arbitrary goal color is unreadable whenever the color is
// close to the theme background; pick whichever of a fixed dark/light
// foreground has the higher contrast against it. Best-of-two guarantees at
// least ~4.5:1 for any input color; anything unparseable falls back to dark text.
export const readableTextColor = (color: string): string => {
	const rgb = colorToRgb(color);
	if (!rgb) return 'hsl(0, 0%, 12%)';
	return contrastRatio([31, 31, 31], rgb) >= contrastRatio([247, 247, 247], rgb)
		? 'hsl(0, 0%, 12%)'
		: 'hsl(0, 0%, 97%)';
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
