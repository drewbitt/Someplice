import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { Intention } from '#lib/trpc/types.js';
import { api, goal, intention } from '../browser-fixtures.js';
import NotDonesPanel from './NotDonesPanel.svelte';
import ActionsDisplay from './ActionsDisplay.svelte';
import IntentionsModal from './IntentionsModal.svelte';
import Review from './review-outcomes/Review.svelte';
import { appTimeZone } from '#lib/stores/timezone.svelte.js';
import TodayPage from '../../../routes/today/+page.svelte';
import { todaysIntentions } from '#lib/stores/todaysIntentions.js';
import { TRPCClientError } from '@trpc/client';
import { dateKeyInZone } from '#lib/utils/index.js';
import { todayPageErrorStore } from '#lib/stores/errors.svelte.js';

vi.mock('$app/navigation', () =>
	import('../browser-fixtures.js').then(({ navigation }) => navigation)
);
vi.mock('#lib/trpc/client.js', () =>
	import('../browser-fixtures.js').then(({ client }) => ({ trpc: () => client }))
);

beforeEach(() => {
	todaysIntentions.current = null;
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

test.each([
	['2026-03-08T05:30:00Z', '2026-03-09T04:00:00Z'],
	['2026-11-01T04:30:00Z', '2026-11-02T05:00:00Z']
])('Today rechecks the date across DST from %s', async (start, midnight) => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	vi.setSystemTime(new Date(start));
	appTimeZone.set('America/New_York');
	await render(TodayPage, {
		data: {
			today: start.slice(0, 10),
			goals: [goal],
			intentions: [],
			intentionsOnLatestDate: [],
			priorities: [],
			inactiveGoals: [],
			recentIntentions: [],
			hasOutstandingOutcome: false
		}
	});
	expect(api.refresh).not.toHaveBeenCalled();
	vi.setSystemTime(new Date(new Date(midnight).getTime() - 60_000));
	await vi.advanceTimersByTimeAsync(60_000);
	expect(api.refresh).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(60_000);
	expect(api.refresh).toHaveBeenCalledTimes(1);
});

test.each([false, true])(
	'conflict refresh preserves the tab-local draft (additional=%s)',
	async (additional) => {
		const data = {
			today: dateKeyInZone(appTimeZone.current),
			goals: [goal],
			intentions: additional ? [intention] : [],
			intentionsOnLatestDate: [],
			priorities: [],
			inactiveGoals: [],
			recentIntentions: [],
			hasOutstandingOutcome: false
		};
		const screen = await render(TodayPage, { data });
		if (additional) await screen.getByRole('button', { name: /^Add more/ }).click();
		const draft = '1a)  Keep my local draft';
		await screen.getByRole('textbox', { name: 'Daily intentions' }).fill(draft);
		const refreshedIntentions = additional
			? [intention, { ...intention, id: 2, orderNumber: 2, text: 'Saved in another tab' }]
			: [intention];
		api.refresh.mockImplementation(() =>
			screen.rerender({ data: { ...data, intentions: refreshedIntentions } })
		);
		api.updateIntentions.mockRejectedValueOnce(
			TRPCClientError.from({
				error: {
					code: -32009,
					message: 'Changed elsewhere',
					data: { code: 'CONFLICT', httpStatus: 409 }
				}
			})
		);
		// A successful save in another tab clears the shared draft, not this editor.
		todaysIntentions.current = null;
		await screen.getByRole('button', { name: /^Set .* intentions$/ }).click();
		await expect.element(screen.getByText('Changed elsewhere')).toBeVisible();
		await expect
			.element(screen.getByRole('textbox', { name: 'Daily intentions' }))
			.toHaveValue(draft);
		await screen.getByRole('button', { name: /^Set .* intentions$/ }).click();
		expect(api.updateIntentions).toHaveBeenLastCalledWith({
			intentions: [
				expect.objectContaining({
					orderNumber: refreshedIntentions.length + 1,
					subIntentionQualifier: 'a',
					text: 'Keep my local draft'
				})
			]
		});
		await screen.getByRole('button', { name: /^Add more/ }).click();
		await expect.element(screen.getByRole('textbox', { name: 'Daily intentions' })).toHaveValue('');
	}
);

test.each([false, true])(
	'Today refreshes stale hydration and retries failures (%s)',
	async (fail) => {
		vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
		vi.setSystemTime(new Date('2026-10-19T00:00:00Z'));
		appTimeZone.set('UTC');
		if (fail) api.refresh.mockRejectedValueOnce(new Error('Offline'));
		await render(TodayPage, {
			data: {
				today: '2026-10-18',
				goals: [goal],
				intentions: [],
				intentionsOnLatestDate: [],
				priorities: [],
				inactiveGoals: [],
				recentIntentions: [],
				hasOutstandingOutcome: false
			}
		});
		expect(api.refresh).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(api.refresh).toHaveBeenCalledTimes(fail ? 2 : 1);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(api.refresh).toHaveBeenCalledTimes(fail ? 2 : 1);
	}
);

test('NotDones uses a native modal, cancels without mutation, and resets strategy', async () => {
	const recent = [1, 2, 3].map((id) => ({
		...intention,
		id,
		date: `2026-10-0${id}T12:00:00.000Z`
	}));
	const onImport = vi.fn();
	const screen = await render(NotDonesPanel, {
		goals: [goal],
		today: '2026-10-04',
		recentIntentions: recent,
		plannedIntentions: [],
		onImport
	});
	const trigger = screen.getByRole('button', { name: 'Add to today: Read a chapter' });
	// Keyboard activation establishes a return-focus target in WebKit too,
	// where pointer clicks do not focus buttons.
	await userEvent.type(trigger, '{Enter}');
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

test('NotDones offers deferred items and imports them as active intentions', async () => {
	const onImport = vi.fn();
	const screen = await render(NotDonesPanel, {
		goals: [goal],
		today: '2026-10-02',
		recentIntentions: [{ ...intention, status: 'not_today' }],
		plannedIntentions: [],
		onImport
	});
	await expect.element(screen.getByText('Thu · Deferred')).toBeVisible();
	await screen.getByRole('button', { name: 'Add to today: Read a chapter' }).click();
	expect(onImport).toHaveBeenCalledExactlyOnceWith('1) Read a chapter');
	await screen.rerender({ plannedIntentions: [intention] });
	await expect
		.element(screen.getByRole('button', { name: /^Add to today:/ }))
		.not.toBeInTheDocument();
});

test('skipping a NotDone survives remounts but expires the next day without changing history', async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
	appTimeZone.set('UTC');
	const deferred = { ...intention, text: 'Deferred episode', status: 'not_today' as const };
	const props = {
		goals: [goal],
		today: '2026-10-02',
		recentIntentions: [deferred],
		plannedIntentions: [],
		onImport: vi.fn()
	};
	const screen = await render(NotDonesPanel, props);
	await screen.getByRole('button', { name: 'Skip today: Deferred episode' }).click();
	await expect
		.element(screen.getByRole('button', { name: /^Add to today:/ }))
		.not.toBeInTheDocument();
	expect(api.setStatus).not.toHaveBeenCalled();
	expect(props.recentIntentions).toEqual([deferred]);
	await screen.unmount();
	const remounted = await render(NotDonesPanel, props);
	await expect.element(remounted.getByRole('region', { name: 'NotDones' })).not.toBeInTheDocument();
	await remounted.unmount();
	vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
	const tomorrow = await render(NotDonesPanel, { ...props, today: '2026-10-03' });
	await expect
		.element(tomorrow.getByRole('button', { name: 'Add to today: Deferred episode' }))
		.toBeVisible();
});

test('NotDones provides an accessible, reversible skip without a history request', async () => {
	const screen = await render(NotDonesPanel, {
		goals: [goal],
		today: '2026-10-02',
		recentIntentions: [{ ...intention, text: 'Undo task' }],
		plannedIntentions: [],
		onImport: vi.fn()
	});
	const add = screen.getByRole('button', { name: 'Add to today: Undo task' });
	await expect.element(add).toBeVisible();
	await screen.getByRole('button', { name: 'Skip today: Undo task' }).click();
	await expect.element(add).not.toBeInTheDocument();
	await expect.element(screen.getByText('Skipped for today: Undo task')).toBeVisible();
	await screen.getByRole('button', { name: 'Undo skip' }).click();
	await expect.element(add).toBeVisible();
	expect(api.setStatus).not.toHaveBeenCalled();
	expect(api.list).not.toHaveBeenCalled();
});

test('Today refreshes recovery history when server data changes without remounting', async () => {
	const data = {
		today: dateKeyInZone(appTimeZone.current),
		goals: [goal],
		intentions: [],
		intentionsOnLatestDate: [],
		priorities: [],
		inactiveGoals: [],
		recentIntentions: [intention],
		hasOutstandingOutcome: false
	};
	const screen = await render(TodayPage, { data });
	await expect
		.element(screen.getByRole('button', { name: 'Add to today: Read a chapter' }))
		.toBeVisible();
	await screen.rerender({
		data: { ...data, recentIntentions: [{ ...intention, status: 'done' }] }
	});
	await expect
		.element(screen.getByRole('button', { name: 'Add to today: Read a chapter' }))
		.not.toBeInTheDocument();
	expect(api.list).not.toHaveBeenCalled();
});

test('draft recovery stays deduplicated and saveable after refreshed empty server data', async () => {
	const data = {
		today: dateKeyInZone(appTimeZone.current),
		goals: [goal],
		intentions: [],
		intentionsOnLatestDate: [],
		priorities: [],
		inactiveGoals: [],
		recentIntentions: [{ ...intention, status: 'not_today' as const }],
		hasOutstandingOutcome: false
	};
	const screen = await render(TodayPage, { data });
	const add = screen.getByRole('button', { name: 'Add to today: Read a chapter' });
	await add.click();
	await expect.element(add).not.toBeInTheDocument();
	await screen.rerender({ data: { ...data } });
	await expect
		.element(screen.getByRole('textbox', { name: 'Daily intentions' }))
		.toHaveValue('1) Read a chapter');
	await expect.element(add).not.toBeInTheDocument();
	await screen.getByRole('button', { name: /^Set .* intentions$/ }).click();
	expect(api.updateIntentions).toHaveBeenCalledExactlyOnceWith({
		intentions: [expect.objectContaining({ status: 'pending', text: 'Read a chapter' })]
	});
});

test('returning to the tab refreshes page data once without a separate history request', async () => {
	const request = Promise.withResolvers<void>();
	api.refresh.mockReturnValue(request.promise);
	await render(TodayPage, {
		data: {
			today: dateKeyInZone(appTimeZone.current),
			goals: [goal],
			intentions: [],
			intentionsOnLatestDate: [],
			priorities: [],
			inactiveGoals: [],
			recentIntentions: [],
			hasOutstandingOutcome: false
		}
	});
	document.dispatchEvent(new Event('visibilitychange'));
	document.dispatchEvent(new Event('visibilitychange'));
	expect(api.refresh).toHaveBeenCalledTimes(1);
	request.resolve();
	await request.promise;
	expect(api.list).not.toHaveBeenCalled();
});

test.each(['pending', 'not_today'] as const)(
	'the %s modal changes status without submitting stale text',
	async (status) => {
		const screen = await render(IntentionsModal, {
			goals: [goal],
			intention: { ...intention, status },
			opened: true
		});
		await screen
			.getByRole('button', { name: status === 'not_today' ? 'Mark pending' : 'Not today' })
			.click();
		expect(api.setStatus).toHaveBeenCalledExactlyOnceWith({
			ids: [intention.id],
			status: status === 'not_today' ? 'pending' : 'not_today'
		});
		expect(api.refresh).toHaveBeenCalledOnce();
	}
);

test('checkbox changes are single-flight and roll back after failure', async () => {
	const failed = Promise.withResolvers<Intention[]>();
	const retry = Promise.withResolvers<Intention[]>();
	api.setCompletion.mockReturnValueOnce(failed.promise).mockReturnValueOnce(retry.promise);
	const screen = await render(ActionsDisplay, {
		recentIntentions: [],
		today: intention.date.slice(0, 10),
		goals: [goal],
		intentions: [intention, { ...intention, id: 2, text: 'Next' }]
	});
	const checkbox = screen.getByRole('checkbox', { name: /Read a chapter$/ });
	await checkbox.click();
	await expect.element(checkbox).toBeDisabled();
	await expect.element(screen.getByRole('button', { name: '1) Next', exact: true })).toBeDisabled();
	expect(api.setCompletion).toHaveBeenCalledExactlyOnceWith({ id: intention.id, completed: true });
	failed.reject(new Error('Offline'));
	await expect.element(checkbox).not.toBeDisabled();
	await expect.element(checkbox).not.toBeChecked();
	await checkbox.click();
	retry.resolve([
		{ ...intention, status: 'done' },
		{ ...intention, id: 2, text: 'Next' }
	]);
	await expect.element(checkbox).toBeChecked();
	await expect.element(checkbox).not.toBeDisabled();
});

test('the current intention skips done, deferred and archived items', async () => {
	const rows: Intention[] = [
		{ ...intention, id: 1, status: 'done', text: 'Finished' },
		{ ...intention, id: 2, status: 'not_today', text: 'Deferred' },
		{ ...intention, id: 3, goalId: 2, text: 'Archived' },
		{ ...intention, id: 4, text: 'Focus here' },
		{ ...intention, id: 5, text: 'Then here' }
	];
	const screen = await render(ActionsDisplay, {
		recentIntentions: [],
		today: intention.date.slice(0, 10),
		goals: [goal, { ...goal, id: 2, active: 0, orderNumber: 2 }],
		intentions: rows
	});
	const current = () => screen.container.querySelectorAll('[aria-current="step"]');
	expect(current()).toHaveLength(1);
	expect(current()[0].textContent).toContain('Focus here');
});

test('native activation uses server order and keeps focus on the moved intention', async () => {
	const later = { ...intention, id: 2, orderNumber: 2, text: 'Later task' };
	const refreshed = { ...intention, orderNumber: 2, text: 'Updated in another tab' };
	const completed: Intention[] = [{ ...later, status: 'done', orderNumber: 1 }, refreshed];
	api.setCompletion
		.mockResolvedValueOnce(completed)
		.mockResolvedValueOnce([{ ...later, orderNumber: 1 }, refreshed])
		.mockResolvedValueOnce(completed);
	const screen = await render(ActionsDisplay, {
		recentIntentions: [],
		today: intention.date.slice(0, 10),
		goals: [goal],
		intentions: [intention, later]
	});
	const action = screen.getByRole('button', { name: '1) Later task', exact: true });
	await userEvent.type(action, '{Enter}');
	await expect.element(action).toHaveAttribute('aria-pressed', 'true');
	await expect.element(action).toHaveFocus();
	expect(
		[...screen.container.querySelectorAll('.intention-row')].map((row) => row.textContent?.trim())
	).toEqual(['1) Later task', '1) Updated in another tab']);
	await action.click();
	await expect.element(action).toHaveAttribute('aria-pressed', 'false');
	await userEvent.type(action, ' ');
	await expect.element(action).toHaveAttribute('aria-pressed', 'true');
});

test.each(['completion', 'reorder'] as const)(
	'a late %s response cannot replace the next day',
	async (operation) => {
		const request = Promise.withResolvers<Intention[]>();
		(operation === 'completion' ? api.setCompletion : api.reorder).mockReturnValueOnce(
			request.promise
		);
		const screen = await render(ActionsDisplay, {
			recentIntentions: [],
			today: '2026-10-01',
			goals: [goal],
			intentions: [intention, { ...intention, id: 2, orderNumber: 2, text: 'Next' }]
		});
		if (operation === 'completion') {
			await screen.getByRole('button', { name: '1) Read a chapter', exact: true }).click();
		} else {
			await userEvent.type(
				screen.getByRole('listitem', { name: '1) Read a chapter', exact: true }),
				'{Enter}{ArrowDown}'
			);
		}
		await screen.rerender({
			today: '2026-10-02',
			intentions: [{ ...intention, id: 3, text: 'New day' }]
		});
		request.resolve([intention, { ...intention, id: 2, orderNumber: 2, text: 'Next' }]);
		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('button', { name: '1) New day', exact: true }))
			.toBeEnabled();
		await expect
			.element(screen.getByRole('button', { name: '1) Read a chapter', exact: true }))
			.not.toBeInTheDocument();
	}
);

test('failed reorder discards the preview and releases the save lock', async () => {
	api.reorder.mockRejectedValueOnce(new Error('Save failed'));
	const screen = await render(ActionsDisplay, {
		recentIntentions: [],
		today: intention.date.slice(0, 10),
		goals: [goal],
		intentions: [intention, { ...intention, id: 2, orderNumber: 2, text: 'Next' }]
	});
	const row = screen.getByRole('listitem', { name: '1) Read a chapter', exact: true });
	await userEvent.type(row, '{Enter}{ArrowDown}');
	await expect.poll(() => todayPageErrorStore.current).toBe('Save failed');
	await userEvent.keyboard('{Escape}');
	await expect.element(screen.getByRole('button', { name: '1) Next', exact: true })).toBeEnabled();
	expect(
		[...screen.container.querySelectorAll('.intention-row .goal-text')].map((row) =>
			row.textContent?.trim()
		)
	).toEqual(['1) Read a chapter', '1) Next']);
	expect(api.refresh).not.toHaveBeenCalled();
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
