import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Priority } from '#lib/trpc/types.js';
import { api, goal, intention } from '../browser-fixtures.js';
import JourneyPage from '../../../routes/journey/+page.svelte';

vi.mock('$app/navigation', () =>
	import('../browser-fixtures.js').then(({ navigation }) => navigation)
);
vi.mock('#lib/trpc/client.js', () =>
	import('../browser-fixtures.js').then(({ client }) => ({ trpc: () => client }))
);

test.each([0, 1])(
	'priority save from day %i updates all days and preserves drafts across server refreshes',
	async (priorityDay) => {
		const dates = ['2026-10-02', '2026-10-01'];
		const data = {
			goals: [goal],
			goalsByDate: Object.fromEntries(dates.map((date) => [date, [goal]])),
			intentionsByDate: Object.fromEntries(
				dates.map((date, index) => [
					date,
					[
						{
							...intention,
							id: index + 1,
							date: `${date}T12:00:00.000Z`
						}
					]
				])
			),
			outcomes: dates.map((date, index) => ({ id: index + 1, date, reviewed: 1 })),
			verdicts: [],
			priorities: [] as Priority[],
			completedPriorities: [],
			oldestLoadedDate: dates[1]
		};
		const priority: Priority = {
			id: 1,
			goalId: 1,
			text: 'Read a book',
			createdAt: intention.date,
			checkInDate: null,
			completedAt: null,
			description: null,
			reflection: null
		};
		api.priorities.mockResolvedValue([priority]);
		const screen = await render(JourneyPage, { data });
		const days = screen.getByRole('group', { name: 'List of Outcomes for the day' });
		const editedDay = days.nth(0);
		const otherDay = days.nth(1);
		await editedDay.getByRole('checkbox', { name: intention.text }).click();
		await editedDay.getByRole('button', { name: 'yes', exact: true }).click();
		await editedDay.getByRole('button', { name: 'Add another outcome not already listed' }).click();
		await editedDay.getByPlaceholder('What did you do?').fill('Unsaved outcome');
		await days
			.nth(priorityDay)
			.getByRole('button', { name: /new top priority/ })
			.click();
		await screen.getByLabelText('Top priority').fill(priority.text);
		await screen.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
		for (const day of [editedDay, otherDay]) {
			await expect.element(day.getByText('1 : Read a book', { exact: true })).toBeVisible();
		}
		expect(api.refresh).not.toHaveBeenCalled();
		await expect.element(editedDay.getByRole('checkbox', { name: intention.text })).toBeChecked();
		await expect
			.element(editedDay.getByRole('button', { name: 'yes', exact: true }))
			.toHaveClass('btn-active');
		await expect
			.element(editedDay.getByPlaceholder('What did you do?'))
			.toHaveValue('Unsaved outcome');
		await screen.rerender({
			data: { ...data, priorities: [{ ...priority, text: 'Updated elsewhere' }] }
		});
		for (const day of [editedDay, otherDay]) {
			await expect.element(day.getByText('1 : Updated elsewhere', { exact: true })).toBeVisible();
		}
		await screen.rerender({ data: { ...data, priorities: [] } });
		await expect.element(otherDay.getByRole('button', { name: /new top priority/ })).toBeVisible();
		await expect
			.element(editedDay.getByPlaceholder('What did you do?'))
			.toHaveValue('Unsaved outcome');
		await editedDay.getByRole('button', { name: 'Save', exact: true }).click();
		expect(api.saveReview).toHaveBeenCalledWith(
			expect.objectContaining({
				statuses: [{ intentionId: 1, status: 'done' }],
				newIntentions: [expect.objectContaining({ text: 'Unsaved outcome' })],
				verdicts: [{ goalId: 1, verdict: 'enough', note: null }]
			})
		);
	}
);

test('Journey shows archived history even without any active goals', async () => {
	const date = '2026-10-01';
	const screen = await render(JourneyPage, {
		data: {
			goals: [],
			goalsByDate: { [date]: [{ ...goal, active: 0 }] },
			intentionsByDate: { [date]: [intention] },
			outcomes: [{ id: 1, date, reviewed: 1 }],
			verdicts: [],
			priorities: [],
			completedPriorities: [],
			oldestLoadedDate: date
		}
	});
	await expect.element(screen.getByText(intention.text, { exact: true })).toBeVisible();
	await expect
		.element(screen.getByText('Begin your Journey by adding goals and intentions.'))
		.not.toBeInTheDocument();
});
