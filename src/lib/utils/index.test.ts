import { describe, expect, it } from 'vitest';
import {
	adjustToUTCStartAndEndOfDay,
	dateKeyInZone,
	dayOfWeekFromDate,
	dayOfWeekInZone,
	goalColorForIntention,
	goalOrderNumberForId,
	goalsForJourneyDay,
	lightenHSL,
	previousDateKey,
	wallClockInZone
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
		...over
	}) as Goal;

describe('utils', () => {
	it("wallClockInZone gives the instant's wall time in the zone as fake-Z UTC fields", () => {
		const instant = new Date('2024-06-03T20:30:00.000Z');
		// UTC+14: the wall clock is June 4 10:30 there
		expect(wallClockInZone('Pacific/Kiritimati', instant).toISOString()).toBe(
			'2024-06-04T10:30:00.000Z'
		);
		expect(wallClockInZone('America/New_York', instant).toISOString()).toBe(
			'2024-06-03T16:30:00.000Z'
		);
	});

	it("dateKeyInZone buckets the instant by the zone's calendar day", () => {
		const instant = new Date('2024-06-03T20:30:00.000Z');
		expect(dateKeyInZone('Pacific/Kiritimati', instant)).toBe('2024-06-04');
		expect(dateKeyInZone('UTC', instant)).toBe('2024-06-03');
		expect(previousDateKey('2024-06-04')).toBe('2024-06-03');
	});

	it('dayOfWeekInZone names the weekday in the zone, not the environment', () => {
		const instant = new Date('2024-06-03T20:30:00.000Z'); // Monday UTC, Tuesday in Kiritimati
		expect(dayOfWeekInZone('Pacific/Kiritimati', instant)).toBe('Tuesday');
		expect(dayOfWeekInZone('UTC', instant)).toBe('Monday');
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
		expect(lightenHSL(color, 0.2)).toBe('hsl(200,50%,52%)');
		expect(lightenHSL(color, 0.4)).toBe('hsl(200,50%,64%)');
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

	it('goalsForJourneyDay merges inactive goals referenced by extra goal ids', () => {
		const active = [goal({ id: 1, orderNumber: 1 })];
		const inactive = [goal({ id: 2, orderNumber: 2, active: 0 })];

		expect(goalsForJourneyDay(active, inactive, [], [2]).map((g) => g.id)).toEqual([1, 2]);
	});
});
