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

const DARK_TEXT: Rgb = [31, 31, 31]; // hsl(0, 0%, 12%)
const LIGHT_TEXT: Rgb = [247, 247, 247]; // hsl(0, 0%, 97%)
const DARK_TEXT_COLOR = 'hsl(0, 0%, 12%)';
const LIGHT_TEXT_COLOR = 'hsl(0, 0%, 97%)';

const srgbChannelToLinear = (channel: number): number => {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

// WCAG 2.x relative luminance.
const relativeLuminance = ([r, g, b]: Rgb): number =>
	0.2126 * srgbChannelToLinear(r) +
	0.7152 * srgbChannelToLinear(g) +
	0.0722 * srgbChannelToLinear(b);

const contrastRatio = (a: Rgb, b: Rgb): number => {
	const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
	const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
	return (lighter + 0.05) / (darker + 0.05);
};

const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
	const s = saturation / 100;
	const l = lightness / 100;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - chroma / 2;
	let r = 0,
		g = 0,
		b = 0;
	if (hue < 60) [r, g, b] = [chroma, x, 0];
	else if (hue < 120) [r, g, b] = [x, chroma, 0];
	else if (hue < 180) [r, g, b] = [0, chroma, x];
	else if (hue < 240) [r, g, b] = [0, x, chroma];
	else if (hue < 300) [r, g, b] = [x, 0, chroma];
	else [r, g, b] = [chroma, 0, x];
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const rgbToHsl = ([r, g, b]: Rgb): [number, number, number] => {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l * 100];
	const d = max - min;
	const s = d / (1 - Math.abs(2 * l - 1));
	let h = 0;
	if (max === r) h = 60 * (((g - b) / d) % 6);
	else if (max === g) h = 60 * ((b - r) / d + 2);
	else h = 60 * ((r - g) / d + 4);
	return [(h + 360) % 360, s * 100, l * 100];
};

// Parses hsl(...) and #rgb/#rrggbb; returns null for anything else.
const parseColorToRgb = (color: string): Rgb | null => {
	const hslMatch = color.trim().match(/^hsl\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?\s*\)$/i);
	if (hslMatch)
		return hslToRgb(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]));
	const hexMatch = color.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hexMatch) {
		let hex = hexMatch[1];
		if (hex.length === 3)
			hex = hex
				.split('')
				.map((c) => c + c)
				.join('');
		const value = parseInt(hex, 16);
		return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
	}
	return null;
};

// Theme text over an arbitrary goal color is unreadable whenever the color is
// close to the theme background; pick whichever of a fixed dark/light
// foreground has the higher WCAG contrast against it. Best-of-two guarantees
// at least ~4.5:1 for any input color. Parses hsl(...) and hex; anything else
// falls back to dark text.
export const readableTextColor = (color: string): string => {
	const rgb = parseColorToRgb(color);
	if (!rgb) return DARK_TEXT_COLOR;
	return contrastRatio(DARK_TEXT, rgb) >= contrastRatio(LIGHT_TEXT, rgb)
		? DARK_TEXT_COLOR
		: LIGHT_TEXT_COLOR;
};

// Goal-colored text on a tint derived from the same color (e.g. review chips)
// is unreadable when the two luminances are close. Nudge the foreground's
// lightness away from the background, keeping its hue and saturation, until
// the WCAG contrast reaches minRatio. Inputs already at or above minRatio are
// returned unchanged so deliberately muted contexts keep their look.
export const ensureMinContrast = (
	foreground: string,
	background: string,
	minRatio: number
): string => {
	const fg = parseColorToRgb(foreground);
	const bg = parseColorToRgb(background);
	if (!fg || !bg) return foreground;
	if (contrastRatio(fg, bg) >= minRatio) return foreground;
	const [hue, saturation, startLightness] = rgbToHsl(fg);
	const darken = relativeLuminance(fg) <= relativeLuminance(bg);
	for (let step = 1; step <= 100; step++) {
		const lightness = darken ? startLightness - step : startLightness + step;
		if (lightness < 0 || lightness > 100) break;
		if (contrastRatio(hslToRgb(hue, saturation, lightness), bg) >= minRatio) {
			return `hsl(${hue} ${saturation}% ${lightness}%)`;
		}
	}
	return darken ? 'hsl(0, 0%, 0%)' : 'hsl(0, 0%, 100%)';
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
