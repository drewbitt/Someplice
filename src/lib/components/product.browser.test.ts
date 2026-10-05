import { beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { UpdateResult } from 'kysely';
import type { Goal, Intention } from '#lib/trpc/types.js';
import { notDones } from '#lib/stores/notDones.svelte.js';
import Editor from './today/actions-input/Editor.svelte';
import ReviewGoalBox from './goals/review-outcomes/ReviewGoalBox.svelte';
import NotDonesPanel from './today/NotDonesPanel.svelte';
import ActionsDisplay from './today/ActionsDisplay.svelte';
import Review from './today/review-outcomes/Review.svelte';
import OutcomesBox from './journey/OutcomesBox.svelte';
import GoalsPage from '../../routes/goals/+page.svelte';
import JourneyPage from '../../routes/journey/+page.svelte';
import '../../app.css';

const api = vi.hoisted(() => ({
	goalLogs: vi.fn(),
	deleteGoal: vi.fn(),
	list: vi.fn(),
	goalsOnDate: vi.fn(),
	priorities: vi.fn(),
	saveReview: vi.fn(),
	savePriority: vi.fn(),
	setStatus: vi.fn(),
	refresh: vi.fn()
}));
vi.mock('$app/navigation', () => ({ refreshAll: api.refresh, beforeNavigate: vi.fn() }));
vi.mock('#lib/trpc/client.js', () => ({
	trpc: () => ({
		goal_logs: { getAllForGoal: { query: api.goalLogs } },
		goals: { delete: { mutate: api.deleteGoal }, listGoalsOnDate: { query: api.goalsOnDate } },
		intentions: { list: { query: api.list }, setStatus: { mutate: api.setStatus } },
		priorities: { list: { query: api.priorities }, upsert: { mutate: api.savePriority } },
		outcomes: { saveReview: { mutate: api.saveReview } }
	})
}));

const goal: Goal = {
	id: 1,
	active: 1,
	orderNumber: 1,
	title: 'Read',
	description: '',
	color: 'navy'
};
const intention: Intention = {
	id: 1,
	goalId: 1,
	orderNumber: 1,
	text: 'Read a chapter',
	status: 'pending',
	subIntentionQualifier: null,
	date: '2026-10-01T12:00:00.000Z'
};

beforeEach(() => {
	vi.resetAllMocks();
	api.goalLogs.mockResolvedValue([]);
	api.deleteGoal.mockRejectedValue(new Error('Offline'));
	api.list.mockResolvedValue([]);
	api.goalsOnDate.mockImplementation(({ active }) => Promise.resolve(active === 0 ? [] : [goal]));
	api.priorities.mockResolvedValue([]);
	api.saveReview.mockResolvedValue({ id: 1 });
	api.savePriority.mockResolvedValue({ id: 1 });
	api.refresh.mockResolvedValue(undefined);
	notDones.recentIntentions = [];
});

test('editor expands only the caret line and preserves selection', async () => {
	const screen = await render(Editor, { value: '', highlight: (value) => value });
	const editor = screen.getByRole('textbox', { name: 'Daily intentions' });
	await editor.fill('1) read 2\n3 ');
	await expect.element(editor).toHaveValue('1) read 2\n3) ');
	const input = editor.element() as HTMLTextAreaElement;
	expect(input.selectionStart).toBe(input.value.length);
	expect(input.selectionEnd).toBe(input.value.length);
});

test('editor does not rewrite its overlay during composition and mirrors scrolling', async () => {
	const screen = await render(Editor, { value: 'original', highlight: (value) => value });
	const editor = screen.getByRole('textbox', { name: 'Daily intentions' });
	const input = editor.element() as HTMLTextAreaElement;
	const pre = input.previousElementSibling as HTMLElement;
	input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
	await screen.rerender({ value: 'composing' });
	expect(pre.textContent).toBe('original');
	input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
	await expect.poll(() => pre.textContent).toBe('composing');
	await editor.fill(Array.from({ length: 30 }, (_, i) => `1) line ${i}`).join('\n'));
	input.scrollTop = 120;
	input.dispatchEvent(new Event('scroll'));
	expect(pre.scrollTop).toBe(input.scrollTop);
	expect(input.scrollTop).toBeGreaterThan(0);
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

test('saving a priority preserves staged review checkbox, verdict and text edits', async () => {
	const screen = await render(OutcomesBox, {
		goals: [goal],
		intentions: [intention],
		outcomes: [{ id: 1, date: '2026-10-01', reviewed: 1 }]
	});
	await screen.getByRole('checkbox', { name: intention.text }).click();
	await screen.getByRole('button', { name: 'yes', exact: true }).click();
	await screen.getByRole('button', { name: 'Add another outcome not already listed' }).click();
	await screen.getByPlaceholder('What did you do?').fill('Unsaved outcome');
	await screen.getByRole('button', { name: /new top priority/ }).click();
	await screen.getByLabelText('Top priority').fill('Read a book');
	await screen.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
	expect(api.refresh).not.toHaveBeenCalled();
	await expect.element(screen.getByRole('checkbox', { name: intention.text })).toBeChecked();
	await expect.element(screen.getByPlaceholder('What did you do?')).toHaveValue('Unsaved outcome');
	await screen
		.getByRole('group', { name: 'List of Outcomes for the day' })
		.getByRole('button', { name: 'Save', exact: true })
		.click();
	expect(api.saveReview).toHaveBeenCalledWith(
		expect.objectContaining({
			statuses: [{ intentionId: 1, status: 'done' }],
			newIntentions: [expect.objectContaining({ text: 'Unsaved outcome' })],
			verdicts: [{ goalId: 1, verdict: 'enough', note: null }]
		})
	);
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
