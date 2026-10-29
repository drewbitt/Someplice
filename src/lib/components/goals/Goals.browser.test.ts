import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { api, goal, intention } from '../browser-fixtures.js';
import ReviewGoalBox from './review-outcomes/ReviewGoalBox.svelte';
import GoalsPage from '../../../routes/goals/+page.svelte';
import { TRPCClientError } from '@trpc/client';
import { userEvent } from 'vitest/browser';

vi.mock('$app/navigation', () =>
	import('../browser-fixtures.js').then(({ navigation }) => navigation)
);
vi.mock('#lib/trpc/client.js', () =>
	import('../browser-fixtures.js').then(({ client }) => ({ trpc: () => client }))
);

test('New Goal focuses an empty draft and Cancel or Escape never creates a goal', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [goal], inactiveGoals: [], priorities: [] }
	});
	const trigger = screen.getByRole('button', { name: 'New Goal', exact: true });
	await trigger.click();
	const title = screen.getByRole('textbox', { name: 'Goal title', exact: true });
	await expect.element(title).toHaveFocus();
	await expect.element(title).toHaveValue('');
	await expect.element(screen.getByRole('button', { name: 'Create goal' })).toBeDisabled();
	await title.fill('   ');
	await expect.element(screen.getByRole('button', { name: 'Create goal' })).toBeDisabled();
	await title.fill('A discarded idea');
	await screen.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect.element(trigger).toHaveFocus();
	await trigger.click();
	await expect.element(title).toHaveValue('');
	await userEvent.keyboard('{Escape}');
	await expect.element(trigger).toHaveFocus();
	expect(api.addGoal).not.toHaveBeenCalled();
	expect(api.updateGoals).not.toHaveBeenCalled();
});

test('goal creation preserves a failed draft, supports Enter and prevents duplicate submits', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [goal], inactiveGoals: [], priorities: [] }
	});
	await screen.getByRole('button', { name: 'New Goal', exact: true }).click();
	const title = screen.getByRole('textbox', { name: 'Goal title', exact: true });
	await title.fill('  Keep learning  ');
	await screen.getByRole('textbox', { name: 'Description (optional)' }).fill('A little every day');
	api.addGoal.mockRejectedValueOnce(new Error('Offline'));
	await title.click();
	await userEvent.keyboard('{Enter}');
	await expect
		.element(screen.getByRole('form', { name: 'New goal' }).getByRole('alert'))
		.toHaveTextContent('Offline');
	await expect.element(title).toHaveValue('  Keep learning  ');
	let finish!: (value: { id: number }) => void;
	api.addGoal.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
	await screen.getByRole('button', { name: 'Create goal', exact: true }).click();
	await expect.element(title).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
	await userEvent.keyboard('{Enter}');
	expect(api.addGoal).toHaveBeenCalledTimes(2);
	expect(api.addGoal).toHaveBeenLastCalledWith({
		title: 'Keep learning',
		description: 'A little every day',
		color: expect.any(String),
		active: 1
	});
	finish({ id: 2 });
	await expect.element(screen.getByRole('button', { name: 'New Goal', exact: true })).toHaveFocus();
	expect(api.refresh).toHaveBeenCalledOnce();
	expect(api.updateGoals).not.toHaveBeenCalled();
});

test('creating a goal exits renumber mode and keeps page editing separate', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [goal], inactiveGoals: [], priorities: [] }
	});
	await screen.getByRole('button', { name: 'Enable renumber goals' }).click();
	await screen.getByRole('button', { name: 'New Goal', exact: true }).click();
	await expect.element(screen.getByRole('textbox', { name: 'Goal title' })).toHaveFocus();
	await expect
		.element(screen.getByRole('button', { name: 'Enable renumber goals' }))
		.toBeDisabled();
	await expect.element(screen.getByRole('button', { name: 'Edit', exact: true })).toBeDisabled();
	await screen.getByRole('button', { name: 'Cancel', exact: true }).click();
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	await expect
		.element(screen.getByRole('button', { name: 'New Goal', exact: true }))
		.toBeDisabled();
});

test('a successful creation closes the draft even when refreshing fails', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [], inactiveGoals: [], priorities: [] }
	});
	api.refresh.mockRejectedValueOnce(new Error('Offline'));
	await screen.getByRole('button', { name: 'New Goal', exact: true }).click();
	await screen.getByRole('textbox', { name: 'Goal title' }).fill('Created once');
	await screen.getByRole('button', { name: 'Create goal', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'New Goal', exact: true })).toBeVisible();
	expect(api.addGoal).toHaveBeenCalledOnce();
});

test('Escape closes the color picker before dismissing the new goal draft', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [], inactiveGoals: [], priorities: [] }
	});
	await screen.getByRole('button', { name: 'New Goal', exact: true }).click();
	await screen.getByRole('textbox', { name: 'Goal title' }).fill('Keep this draft');
	await screen.getByRole('button', { name: 'Choose goal color' }).click();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.poll(() => screen.container.querySelector('dialog')?.open).toBe(false);
	await expect
		.element(screen.getByRole('textbox', { name: 'Goal title' }))
		.toHaveValue('Keep this draft');
	expect(api.addGoal).not.toHaveBeenCalled();
});

test('Escape during text composition does not discard a goal draft', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [], inactiveGoals: [], priorities: [] }
	});
	await screen.getByRole('button', { name: 'New Goal', exact: true }).click();
	const title = screen.getByRole('textbox', { name: 'Goal title' });
	await title.fill('Writing in progress');
	title
		.element()
		.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true })
		);
	await expect.element(title).toHaveValue('Writing in progress');
	expect(api.addGoal).not.toHaveBeenCalled();
});

test('saving goals disables all editor controls until the request settles', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [goal], inactiveGoals: [], priorities: [] }
	});
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	const title = screen.getByRole('textbox', { name: 'Goal title' });
	await title.fill('Submitted draft');
	let reject!: (reason: Error) => void;
	api.updateGoals.mockImplementationOnce(() => new Promise((_, fail) => (reject = fail)));
	await screen.getByRole('button', { name: 'Save', exact: true }).click();
	for (const control of [
		title,
		screen.getByRole('textbox', { name: 'Goal description' }),
		screen.getByRole('button', { name: 'Choose goal color' }),
		screen.getByRole('button', { name: 'Archive goal' }),
		screen.getByRole('button', { name: 'Cancel', exact: true })
	])
		await expect.element(control).toBeDisabled();
	reject(new Error('Offline'));
	await expect.element(title).toBeEnabled();
	await expect.element(title).toHaveValue('Submitted draft');
});

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

test('legacy whitespace-only titles can be edited and repaired', async () => {
	const screen = await render(GoalsPage, {
		data: {
			goals: [{ ...goal, title: '   ' }],
			inactiveGoals: [],
			priorities: []
		}
	});
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	const save = screen.getByRole('button', { name: 'Save', exact: true });
	await expect.element(save).toBeDisabled();
	await screen.getByRole('textbox').first().fill('Read');
	await expect.element(save).toBeEnabled();
	await save.click();
	expect(api.updateGoals).toHaveBeenCalledWith({
		goals: [expect.objectContaining({ title: 'Read' })]
	});
});

test('goal conflicts resync using the error code, not message text', async () => {
	const screen = await render(GoalsPage, {
		data: { goals: [goal], inactiveGoals: [], priorities: [] }
	});
	api.updateGoals.mockRejectedValueOnce(
		TRPCClientError.from({
			error: {
				code: -32009,
				message: 'Changed elsewhere',
				data: { code: 'CONFLICT', httpStatus: 409 }
			}
		})
	);
	await screen.getByRole('button', { name: 'Edit', exact: true }).click();
	await screen.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
	expect(api.refresh).toHaveBeenCalledOnce();
});

test('inactive-only goals still expose edit, restore and delete controls', async () => {
	const archived = { ...goal, active: 0, orderNumber: 0, date: intention.date };
	const screen = await render(GoalsPage, {
		data: {
			goals: [],
			inactiveGoals: [archived],
			priorities: []
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
			priorities: []
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
