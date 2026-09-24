import { describe, expect, it } from 'vitest';
import {
	adjustToUTCStartAndEndOfDay,
	dayOfWeekFromDate,
	evenLighterHSLColor,
	goalColorForIntention,
	goalOrderNumberForId,
	goalsForJourneyDay,
	lighterHSLColor,
	localeCurrentDate,
	localePreviousDate
} from './index.ts';
import type { Goal, Intention } from '../trpc/types';

const goal = (over: Partial<Goal>): Goal =>
	({
		id: 1,
		title: 'g',
		description: '',
		color: 'red',
		orderNumber: 1,
		active: 1,
		completed: 0,
		startDate: new Date(),
		...over
	}) as Goal;

describe('utils', () => {
	it('localeCurrentDate is shifted by the timezone offset', () => {
		const now = new Date();
		const expected = now.getTime() - now.getTimezoneOffset() * 60000;
		expect(Math.abs(localeCurrentDate().getTime() - expected)).toBeLessThan(1000);
	});

	it('localePreviousDate is about one day earlier', () => {
		const diffMs = localeCurrentDate().getTime() - localePreviousDate().getTime();
		expect(Math.abs(diffMs - 24 * 60 * 60 * 1000)).toBeLessThan(1000);
	});

	it('adjustToUTCStartAndEndOfDay bounds the UTC day', () => {
		const { startDate, endDate } = adjustToUTCStartAndEndOfDay(
			new Date('2024-03-10T15:30:00Z'),
			new Date('2024-03-10T15:30:00Z')
		);
		expect(startDate.toISOString()).toBe('2024-03-10T00:00:00.000Z');
		expect(endDate.toISOString()).toBe('2024-03-10T23:59:59.999Z');
	});

	it('dayOfWeekFromDate returns the UTC weekday name', () => {
		expect(dayOfWeekFromDate(new Date('2024-06-03T00:00:00Z'))).toBe('Monday');
	});

	it('HSL lightening increases lightness monotonically', () => {
		const color = 'hsl(200 50% 40%)';
		expect(lighterHSLColor(color)).toBe('hsl(200,50%,52%)');
		expect(evenLighterHSLColor(color)).toBe('hsl(200,50%,64%)');
	});

	it('goalColorForIntention falls back to black', () => {
		const goals = [goal({ id: 5, color: 'green' })];
		expect(goalColorForIntention({ goalId: 5 } as Intention, goals)).toBe('green');
		expect(goalColorForIntention({ goalId: 9 } as Intention, goals)).toBe('black');
	});

	it('goalOrderNumberForId returns -1 for unknown ids', () => {
		const goals = [goal({ id: 2, orderNumber: 7 })];
		expect(goalOrderNumberForId(2, goals)).toBe(7);
		expect(goalOrderNumberForId(99, goals)).toBe(-1);
	});

	it('goalsForJourneyDay merges in inactive goals that have intentions that day', () => {
		const active = [goal({ id: 1, orderNumber: 1 })];
		const inactive = [
			goal({ id: 2, orderNumber: 2, active: 0 }),
			goal({ id: 3, orderNumber: 3, active: 0 })
		];
		const intentions = [{ goalId: 2 } as Intention];
		expect(goalsForJourneyDay(active, inactive, intentions).map((g) => g.id)).toEqual([1, 2]);
	});
});
