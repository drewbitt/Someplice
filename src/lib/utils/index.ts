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

export const goalColorForIntention = (intention: Intention, goals: Goal[]) => {
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
