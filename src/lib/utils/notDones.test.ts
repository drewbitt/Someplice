import { describe, expect, it } from 'vitest';
import type { Intention } from '../trpc/types';
import {
	computeMissCount,
	groupNotDones,
	intentionMatchKey,
	statusFromReviewCheckbox
} from './notDones.ts';

const intention = (over: Partial<Intention>): Intention =>
	({
		id: 1,
		goalId: 1,
		orderNumber: 1,
		status: 'pending',
		text: 'do the thing',
		subIntentionQualifier: null,
		date: '2026-09-21T10:00:00.000Z',
		...over
	}) as Intention;

describe('NotDones helpers', () => {
	it('intentionMatchKey strips only the appended strategy suffix', () => {
		expect(intentionMatchKey(1, 'Call mom')).toBe('1|call mom');
		expect(intentionMatchKey(1, 'Call mom ⟶ set an alarm')).toBe('1|call mom');
		expect(intentionMatchKey(1, 'Call mom — keep the em dash')).toBe(
			'1|call mom — keep the em dash'
		);
		expect(intentionMatchKey(1, 'call mom')).toBe(intentionMatchKey(1, 'Call mom'));
		expect(intentionMatchKey(2, 'call mom')).not.toBe(intentionMatchKey(1, 'call mom'));
	});

	it('computeMissCount counts distinct pending days only', () => {
		const recent = [
			intention({ id: 1, date: '2026-09-21T09:00:00.000Z' }),
			intention({ id: 2, date: '2026-09-21T12:00:00.000Z' }),
			intention({ id: 3, date: '2026-09-22T09:00:00.000Z' }),
			intention({ id: 4, date: '2026-09-23T09:00:00.000Z', status: 'not_today' }),
			intention({ id: 5, date: '2026-09-23T00:00:00.000Z', status: 'done' }),
			intention({ id: 6, goalId: 2, text: 'other', date: '2026-09-23T09:00:00.000Z' })
		];
		expect(computeMissCount(recent, 1, 'do the thing')).toBe(2);
		expect(computeMissCount(recent, 1, 'Do the thing ⟶ a strategy')).toBe(2);
		expect(computeMissCount(recent, 2, 'other')).toBe(1);
		expect(computeMissCount(recent, 2, 'missing')).toBe(0);
	});

	it('groupNotDones groups by goal+text with the latest pending row representative', () => {
		const recent = [
			intention({ id: 1, date: '2026-09-21T09:00:00.000Z', orderNumber: 3 }),
			intention({ id: 2, date: '2026-09-22T09:00:00.000Z', orderNumber: 4 }),
			intention({ id: 3, date: '2026-09-22T10:00:00.000Z', status: 'done' }),
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
