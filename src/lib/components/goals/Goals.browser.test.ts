import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { api, goal, intention } from '../browser-fixtures.js';
import ReviewGoalBox from './review-outcomes/ReviewGoalBox.svelte';
import GoalsPage from '../../../routes/goals/+page.svelte';

vi.mock('$app/navigation', () =>
	import('../browser-fixtures.js').then(({ navigation }) => navigation)
);
vi.mock('#lib/trpc/client.js', () =>
	import('../browser-fixtures.js').then(({ client }) => ({ trpc: () => client }))
);

test.each([
	['hsl(212.452 71.736% 80.365%)', 'rgb(0, 0, 0)'],
	['navy', 'rgb(255, 255, 255)']
])('goal title contrasts with its %s fill', async (color, expected) => {
	const screen = await render(ReviewGoalBox, {
		goal: { ...goal, color },
		intentions: [],
		showTitle: true,
		saveRevision: 0
	});
	await expect
		.element(screen.getByText(goal.title, { exact: true }))
		.toHaveStyle({ color: expected });
});

test('outcome drafts reset on every successful save, not just the first', async () => {
	const screen = await render(ReviewGoalBox, {
		goal,
		intentions: [],
		showTitle: true,
		saveRevision: 0
	});
	for (let revision = 1; revision <= 2; revision++) {
		await screen.getByRole('button', { name: 'Add another outcome not already listed' }).click();
		await screen.getByPlaceholder('What did you do?').fill(`Outcome ${revision}`);
		await screen.rerender({ saveRevision: revision });
		await expect.element(screen.getByPlaceholder('What did you do?')).not.toBeInTheDocument();
	}
});

test('inactive-only goals still expose edit, restore and delete controls', async () => {
	const archived = { ...goal, active: 0, orderNumber: 0, date: intention.date };
	const screen = await render(GoalsPage, {
		data: {
			goals: [],
			inactiveGoals: [archived],
			priorities: [],
			goalLogs: [{ id: 1, goalId: 1, type: 'end', date: intention.date, orderNumber: null }]
		}
	});
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: /Restore/i })).toBeVisible();
	await expect.element(screen.getByRole('button', { name: /Delete/i })).toBeVisible();
});

test('goal deletion confirmation resets after a failed attempt and reopening', async () => {
	const screen = await render(GoalsPage, {
		data: {
			goals: [],
			inactiveGoals: [{ ...goal, active: 0 }],
			priorities: [],
			goalLogs: []
		}
	});
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	const trigger = screen.getByRole('button', { name: /Delete/i });
	await trigger.click();
	await screen.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(() => api.deleteGoal.mock.calls.length).toBe(1);
	await trigger.click();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await screen.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	await expect.poll(() => api.deleteGoal.mock.calls.length).toBe(2);
});
