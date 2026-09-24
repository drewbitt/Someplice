import { describe, expect, it } from 'vitest';
import {
	adjustToUTCStartAndEndOfDay,
	computeMissCount,
	dayOfWeekFromDate,
	evenLighterHSLColor,
	goalColorForIntention,
	goalOrderNumberForId,
	goalsForJourneyDay,
	groupNotDones,
	intentionMatchKey,
	lighterHSLColor,
	localeCurrentDate,
	localePreviousDate,
	statusFromReviewCheckbox,
	type IntentionRow
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

const intention = (over: Partial<IntentionRow>): IntentionRow =>
	({
		id: 1,
		goalId: 1,
		orderNumber: 1,
		status: 'pending',
		text: 'do the thing',
		subIntentionQualifier: null,
		date: '2026-09-21T10:00:00.000Z',
		...over
	}) as IntentionRow;

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

	it('intentionMatchKey normalizes case and drops the strategy suffix', () => {
		expect(intentionMatchKey(1, 'Call mom')).toBe('1|call mom');
		expect(intentionMatchKey(1, 'Call mom — set an alarm')).toBe('1|call mom');
		expect(intentionMatchKey(1, 'call mom')).toBe(intentionMatchKey(1, 'Call mom'));
		expect(intentionMatchKey(2, 'call mom')).not.toBe(intentionMatchKey(1, 'call mom'));
	});

	it('computeMissCount counts distinct pending days only', () => {
		const recent = [
			intention({ id: 1, date: '2026-09-21T09:00:00.000Z' }),
			intention({ id: 2, date: '2026-09-21T12:00:00.000Z' }), // same day — still one miss
			intention({ id: 3, date: '2026-09-22T09:00:00.000Z' }),
			intention({ id: 4, date: '2026-09-23T09:00:00.000Z', status: 'not_today' }), // resolved
			intention({ id: 5, date: '2026-09-23T09:00:00.000Z', status: 'done' }), // resolved
			intention({ id: 6, goalId: 2, text: 'other', date: '2026-09-23T09:00:00.000Z' })
		];
		expect(computeMissCount(recent, 1, 'do the thing')).toBe(2);
		expect(computeMissCount(recent, 1, 'Do the thing — a strategy')).toBe(2);
		expect(computeMissCount(recent, 2, 'other')).toBe(1);
		expect(computeMissCount(recent, 2, 'missing')).toBe(0);
	});

	it('groupNotDones groups by goal+text with the latest pending row representative', () => {
		const recent = [
			intention({ id: 1, date: '2026-09-21T09:00:00.000Z', orderNumber: 3 }),
			intention({ id: 2, date: '2026-09-22T09:00:00.000Z', orderNumber: 4 }),
			intention({ id: 3, date: '2026-09-22T10:00:00.000Z', status: 'done' }), // not pending
			intention({ id: 4, goalId: 2, text: 'another', date: '2026-09-22T11:00:00.000Z' })
		];
		const groups = groupNotDones(recent);
		expect(groups).toHaveLength(2);
		const group = groups.find((g) => g.representative.goalId === 1);
		expect(group?.missCount).toBe(2);
		expect(group?.representative.id).toBe(2);
		expect(group?.occurrences.map((o) => o.id).sort()).toEqual([1, 2]);
	});

	it('statusFromReviewCheckbox preserves not_today and maps checked to done', () => {
		expect(statusFromReviewCheckbox(intention({ status: 'pending' }), true)).toBe('done');
		expect(statusFromReviewCheckbox(intention({ status: 'pending' }), false)).toBe('pending');
		expect(statusFromReviewCheckbox(intention({ status: 'not_today' }), false)).toBe('not_today');
		expect(statusFromReviewCheckbox(intention({ status: 'not_today' }), true)).toBe('done');
		expect(statusFromReviewCheckbox(undefined, false)).toBe('pending');
	});
});
