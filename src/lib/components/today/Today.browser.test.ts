import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { UpdateResult } from 'kysely';
import type { Intention } from '#lib/trpc/types.js';
import { api, goal, intention } from '../browser-fixtures.js';
import NotDonesPanel from './NotDonesPanel.svelte';
import ActionsDisplay from './ActionsDisplay.svelte';
import Review from './review-outcomes/Review.svelte';
import { notDones } from '#lib/stores/notDones.svelte.js';

vi.mock('$app/navigation', () =>
	import('../browser-fixtures.js').then(({ navigation }) => navigation)
);
vi.mock('#lib/trpc/client.js', () =>
	import('../browser-fixtures.js').then(({ client }) => ({ trpc: () => client }))
);

beforeEach(() => {
	notDones.recentIntentions = [];
});

test('NotDones uses a native modal, cancels without mutation, and resets strategy', async () => {
	const recent = [1, 2, 3].map((id) => ({
		...intention,
		id,
		date: `2026-10-0${id}T12:00:00.000Z`
	}));
	api.list.mockResolvedValue(recent);
	const onImport = vi.fn();
	const screen = await render(NotDonesPanel, { goals: [goal], plannedIntentions: [], onImport });
	const trigger = screen.getByRole('button', { name: 'Import Read a chapter into today' });
	await trigger.click();
	expect(document.querySelector('dialog')?.matches(':modal')).toBe(true);
	const strategy = screen.getByRole('textbox', { name: 'How will you make it happen today?' });
	await strategy.fill('Old strategy');
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	await expect.element(trigger).toHaveFocus();
	expect(onImport).not.toHaveBeenCalled();
	expect(api.setStatus).not.toHaveBeenCalled();
	await trigger.click();
	await expect.element(strategy).toHaveValue('');
	await expect.element(screen.getByRole('button', { name: 'Keep', exact: true })).toBeDisabled();
	await strategy.fill('Before breakfast');
	await screen.getByRole('button', { name: 'Keep', exact: true }).click();
	expect(onImport).toHaveBeenCalledExactlyOnceWith('1) Read a chapter ⟶ Before breakfast');
});

test('checkbox changes are single-flight and roll back after failure', async () => {
	let finish!: (value: UpdateResult | undefined) => void;
	const update = vi.fn(
		(_intention: Intention) =>
			new Promise<UpdateResult | undefined>((resolve) => {
				finish = resolve;
			})
	);
	const screen = await render(ActionsDisplay, {
		goals: [goal],
		intentions: [intention],
		handleUpdateSingleIntention: update
	});
	const checkbox = screen.getByRole('checkbox', { name: /Read a chapter$/ });
	await checkbox.click();
	await expect.element(checkbox).toBeDisabled();
	expect(update).toHaveBeenCalledTimes(1);
	expect(update.mock.calls[0]).toEqual([{ ...intention, status: 'done' }]);
	finish(undefined);
	await expect.element(checkbox).not.toBeDisabled();
	await expect.element(checkbox).not.toBeChecked();
	await checkbox.click();
	finish(new UpdateResult(1n, undefined));
	await expect.element(checkbox).toBeChecked();
	await expect.element(checkbox).not.toBeDisabled();
});

test('failed review loading blocks saving and exposes a working retry', async () => {
	api.list.mockRejectedValueOnce(new Error('Offline'));
	const screen = await render(Review, {
		intentionsOnLatestDate: [intention],
		setHasOutstandingOutcome: vi.fn()
	});
	await expect.element(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	await screen.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
	expect(api.saveReview).not.toHaveBeenCalled();
});
