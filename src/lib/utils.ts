import type { Goal, Intention } from './trpc/types';

export const localeCurrentDate = () => {
	return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000);
};

export const lighterHSLColor = (color: string): string => {
	const [hue, saturation, lightness] = color
		.slice(4, -1)
		.split(' ')
		.map((x) => parseFloat(x));
	const lighterLightness = lightness + (100 - lightness) * 0.2;
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
