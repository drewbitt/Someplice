import { describe, expect, it } from 'vitest';
import type { Goal } from '#lib/trpc/types.js';
import {
	journeyDates,
	loadJourneyGoals,
	mergeWindows,
	omitWindowDays,
	type JourneyWindow
} from './windows.js';

const day = '2026-10-03';
const olderDay = '2026-09-01';
const goal: Goal = {
	id: 1,
	title: 'Goal',
	description: '',
	active: 1,
	orderNumber: 1,
	color: 'navy'
};

function dayWindow(date = day, id = 1): JourneyWindow {
	return {
		intentionsByDate: {
			[date]: [
				{
					id,
					goalId: 1,
					text: 'Action',
					status: 'pending',
					date: `${date}T12:00:00.000Z`,
					orderNumber: 1,
					subIntentionQualifier: null
				}
			]
		},
		goalsByDate: { [date]: [goal] },
		outcomes: [{ id, date, reviewed: 1 }],
		verdicts: [{ id, outcomeId: id, goalId: 1, verdict: 'enough', note: 'Old verdict' }],
		completedPriorities: [
			{
				id,
				goalId: 1,
				text: 'Milestone',
				description: null,
				createdAt: `${date}T00:00:00.000Z`,
				completedAt: `${date}T12:00:00.000Z`,
				checkInDate: null,
				reflection: null
			}
		]
	};
}

describe('Journey window reconciliation', () => {
	it('replaces a server-loaded day and remains stable across repeated refreshes', () => {
		const base = mergeWindows(dayWindow(), dayWindow(olderDay, 2));
		const fresh = dayWindow();
		fresh.intentionsByDate[day][0].status = 'done';
		fresh.verdicts[0].note = 'Updated verdict';
		fresh.completedPriorities[0].text = 'Updated milestone';
		fresh.goalsByDate[day] = [{ ...goal, title: 'Historical goal' }];

		const result = mergeWindows(mergeWindows(base, fresh), fresh);

		expect(result.outcomes.map((row) => row.id)).toEqual([2, 1]);
		expect(result.completedPriorities.map((row) => row.id)).toEqual([2, 1]);
		expect(result.verdicts.filter((row) => row.outcomeId === 1)).toEqual(fresh.verdicts);
		expect(result.intentionsByDate[day][0].status).toBe('done');
		expect(result.completedPriorities[1].text).toBe('Updated milestone');
		expect(result.goalsByDate[day][0].title).toBe('Historical goal');
		expect(result.intentionsByDate[olderDay]).toEqual(base.intentionsByDate[olderDay]);
		expect(base.intentionsByDate[day][0].status).toBe('pending');
	});

	it('removes deleted rows, verdicts, and snapshots even when the refreshed day is empty', () => {
		const base = mergeWindows(dayWindow(), dayWindow(olderDay, 2));
		const empty: JourneyWindow = {
			intentionsByDate: { [day]: [] },
			goalsByDate: { [day]: [] },
			outcomes: [],
			verdicts: [],
			completedPriorities: []
		};

		const result = mergeWindows(base, empty);

		expect(result.outcomes).toEqual(dayWindow(olderDay, 2).outcomes);
		expect(result.verdicts).toEqual(dayWindow(olderDay, 2).verdicts);
		expect(result.completedPriorities).toEqual(dayWindow(olderDay, 2).completedPriorities);
		expect(result.intentionsByDate[day]).toEqual([]);
		expect(result.goalsByDate[day]).toEqual([]);
		expect(journeyDates(result)).toEqual([olderDay]);
	});

	it('preserves paginated days when a new server load replaces the current window', () => {
		const server = dayWindow();
		const extras = mergeWindows(dayWindow(), dayWindow(olderDay, 2));
		server.verdicts[0].note = 'Refreshed by server';
		const retained = omitWindowDays(extras, new Set([day]));
		const result = mergeWindows(server, retained);

		expect(result.verdicts.find((verdict) => verdict.outcomeId === 1)?.note).toBe(
			'Refreshed by server'
		);
		expect(result.outcomes.map((outcome) => outcome.id)).toEqual([1, 2]);
		expect(result.goalsByDate[olderDay]).toEqual(extras.goalsByDate[olderDay]);
	});

	it('replaces outcome-only and milestone-only days on overlapping pages', () => {
		const base = dayWindow();
		base.intentionsByDate = {};
		base.goalsByDate = {};
		const fresh = dayWindow();
		fresh.intentionsByDate = {};
		fresh.goalsByDate = {};
		fresh.verdicts = [];
		fresh.completedPriorities[0].reflection = 'Finished';

		const result = mergeWindows(base, fresh);
		expect(result.outcomes).toHaveLength(1);
		expect(result.verdicts).toEqual([]);
		expect(result.completedPriorities).toHaveLength(1);
		expect(result.completedPriorities[0].reflection).toBe('Finished');
	});

	it('clears a deleted day using only its intention marker', () => {
		const empty: JourneyWindow = {
			intentionsByDate: { [day]: [] },
			goalsByDate: {},
			outcomes: [],
			verdicts: [],
			completedPriorities: []
		};
		const result = mergeWindows(dayWindow(), empty);

		expect(result.goalsByDate).toEqual({});
		expect(result.outcomes).toEqual([]);
		expect(result.verdicts).toEqual([]);
		expect(result.completedPriorities).toEqual([]);
		expect(journeyDates(result)).toEqual([]);
	});

	it('loads historical goals referenced by intentions, verdicts and milestones on their own day', async () => {
		const rows = mergeWindows(dayWindow(), dayWindow(olderDay, 2));
		rows.intentionsByDate[day][0].goalId = 2;
		rows.intentionsByDate[olderDay] = [];
		rows.verdicts[1].goalId = 3;
		rows.completedPriorities[1].goalId = 4;
		rows.intentionsByDate['2026-08-01'] = [];
		const goals = await loadJourneyGoals(rows, async () => [
			[goal],
			[2, 3, 4, 5].map((id) => ({ ...goal, id, orderNumber: id, active: 0 }))
		]);

		expect(goals[day].map((goal) => goal.id)).toEqual([1, 2]);
		expect(goals[olderDay].map((goal) => goal.id)).toEqual([1, 3, 4]);
		expect(goals['2026-08-01']).toBeUndefined();
	});
});
