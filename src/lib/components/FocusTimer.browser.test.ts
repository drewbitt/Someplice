import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { RouterOutputs } from '#lib/trpc/router.js';
import FocusTimer from './FocusTimer.svelte';
import '../../app.css';

const api = vi.hoisted(() => ({
	state: { query: vi.fn() },
	start: { mutate: vi.fn() },
	control: { mutate: vi.fn() }
}));
vi.mock('#lib/trpc/client.js', () => ({ trpc: () => ({ focus: api }) }));
type Snapshot = RouterOutputs['focus']['state'];
type Session = NonNullable<Snapshot['active']>;
const defaults = {
	workMinutes: 25,
	hourglassMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 20
};
const session = (kind: Session['kind'] = 'pomodoro'): Session => ({
	id: '11111111-1111-4111-8111-111111111111',
	kind,
	status: 'running',
	day: '2026-11-08',
	intentionId: 1,
	intentionText: 'Read a chapter',
	plannedSeconds: 1500,
	elapsedSeconds: 0,
	startedAt: Date.now(),
	lastStartedAt: Date.now(),
	endedAt: null,
	revision: 0
});
const snapshot = (active: Session | null = null): Snapshot => ({
	now: Date.now(),
	day: '2026-11-08',
	active,
	latest: active,
	recent: [],
	totals: { pomodoros: 0, seconds: 0 },
	preferences: defaults,
	intentions: [
		{ id: 1, text: 'Read a chapter', goalTitle: 'Read' },
		{ id: 2, text: 'Draft proposal', goalTitle: 'Work' }
	]
});

beforeEach(() => {
	vi.resetAllMocks();
	api.state.query.mockResolvedValue(snapshot());
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

test('starts the selected intention and prevents duplicate submissions while saving', async () => {
	let resolve!: (value: Snapshot) => void;
	api.start.mutate.mockReturnValue(
		new Promise<Snapshot>((done) => {
			resolve = done;
		})
	);
	const screen = await render(FocusTimer, { today: true });
	await screen.getByRole('combobox', { name: 'Work on' }).selectOptions('2');
	await screen.getByRole('button', { name: 'Start Pomodoro · 25m' }).click();
	await expect.element(screen.getByRole('button', { name: 'Start Pomodoro · 25m' })).toBeDisabled();
	expect(api.start.mutate).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({
			kind: 'pomodoro',
			intentionId: 2,
			minutes: 25,
			preferences: defaults
		})
	);
	const current = { ...session(), intentionId: 2, intentionText: 'Draft proposal' };
	api.state.query.mockResolvedValue(snapshot(current));
	resolve(snapshot(current));
	await expect.element(screen.getByRole('timer')).toHaveTextContent('25:00');
	await expect.element(screen.getByText('Draft proposal', { exact: true })).toBeVisible();
	await expect
		.element(screen.getByRole('button', { name: 'Pause', exact: true }))
		.not.toBeInTheDocument();
});

test('failed starts preserve settings and reuse their request ID on retry', async () => {
	api.start.mutate.mockRejectedValue(new Error('Offline'));
	const screen = await render(FocusTimer, { today: true });
	await screen.getByRole('button', { name: 'Start Pomodoro · 25m' }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent('Offline');
	await screen.getByRole('button', { name: 'Start Pomodoro · 25m' }).click();
	expect(api.start.mutate).toHaveBeenCalledTimes(2);
	expect(api.start.mutate.mock.calls[0][0].id).toBe(api.start.mutate.mock.calls[1][0].id);
});

test('strict cancellation explains lost credit and Escape keeps the timer running', async () => {
	api.state.query.mockResolvedValue(snapshot(session()));
	const screen = await render(FocusTimer, { today: true });
	await screen
		.getByRole('region', { name: 'Pomodoro', exact: true })
		.getByRole('button', { name: 'Cancel Pomodoro', exact: true })
		.click();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await expect.element(screen.getByRole('dialog').getByText(/This unfinished block/)).toBeVisible();
	await userEvent.keyboard('{Escape}');
	await expect.poll(() => screen.container.querySelector('dialog')?.open).toBe(false);
	expect(api.control.mutate).not.toHaveBeenCalled();
	await screen
		.getByRole('region', { name: 'Pomodoro', exact: true })
		.getByRole('button', { name: 'Cancel Pomodoro', exact: true })
		.click();
	const cancelled = snapshot();
	cancelled.latest = {
		...session(),
		status: 'cancelled',
		endedAt: Date.now(),
		lastStartedAt: null,
		revision: 1
	};
	api.control.mutate.mockResolvedValue(cancelled);
	api.state.query.mockResolvedValue(cancelled);
	await screen
		.getByRole('dialog')
		.getByRole('button', { name: 'Cancel Pomodoro', exact: true })
		.click();
	expect(api.control.mutate).toHaveBeenCalledExactlyOnceWith({
		id: session().id,
		revision: 0,
		action: 'cancel'
	});
	await expect.element(screen.getByRole('button', { name: 'Start Pomodoro · 25m' })).toBeVisible();
});

test('hourglass supports pause and partial save without cancellation confirmation', async () => {
	const current = session('hourglass');
	api.state.query.mockResolvedValue(snapshot(current));
	const screen = await render(FocusTimer, { today: true });
	const paused = {
		...current,
		status: 'paused' as const,
		lastStartedAt: null,
		elapsedSeconds: 120,
		revision: 1
	};
	api.control.mutate.mockResolvedValue(snapshot(paused));
	api.state.query.mockResolvedValue(snapshot(paused));
	await screen.getByRole('button', { name: 'Pause', exact: true }).click();
	await expect.element(screen.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	await expect.element(screen.getByRole('timer')).toHaveTextContent('23:00');
	const saved = snapshot();
	saved.latest = { ...paused, status: 'completed', endedAt: Date.now(), revision: 2 };
	saved.recent = [saved.latest];
	saved.totals.seconds = 120;
	api.control.mutate.mockResolvedValue(saved);
	api.state.query.mockResolvedValue(saved);
	await screen.getByRole('button', { name: 'Save & stop' }).click();
	expect(api.control.mutate).toHaveBeenLastCalledWith({
		id: current.id,
		revision: 1,
		action: 'stop'
	});
	await expect.element(screen.getByText('0 Pomodoros · 2 min recorded today')).toBeVisible();
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('reconciles an expired clock once and announces completion without starting another timer', async () => {
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	const current = { ...session(), plannedSeconds: 60 };
	api.state.query.mockResolvedValue(snapshot(current));
	const screen = await render(FocusTimer, { today: true });
	await expect.element(screen.getByRole('timer')).toBeVisible();
	const finished = snapshot();
	finished.latest = {
		...current,
		status: 'completed',
		elapsedSeconds: 60,
		endedAt: current.startedAt + 60_000,
		lastStartedAt: null
	};
	api.state.query.mockResolvedValue(finished);
	await vi.advanceTimersByTimeAsync(60_000);
	await expect.element(screen.getByRole('status')).toHaveTextContent('Pomodoro complete.');
	await expect.element(screen.getByRole('button', { name: 'Take break · 5m' })).toBeVisible();
	expect(api.start.mutate).not.toHaveBeenCalled();
});

test('keeps a pinned active timer available in the compact cross-page view', async () => {
	const current = session();
	api.state.query.mockResolvedValue(snapshot(current));
	const screen = await render(FocusTimer, { today: true });
	await expect.element(screen.getByText('Read a chapter', { exact: true })).toBeVisible();
	await screen.rerender({ today: false, refreshKey: { page: 'goals' } });
	await expect.element(screen.getByRole('link', { name: 'Today', exact: true })).toBeVisible();
	await expect.element(screen.getByRole('timer')).toBeVisible();
	expect(api.start.mutate).not.toHaveBeenCalled();
});

test('uses editable durations, unassigned work and the long break suggestion', async () => {
	const initial = snapshot();
	initial.totals.pomodoros = 4;
	api.state.query.mockResolvedValue(initial);
	api.start.mutate.mockRejectedValue(new Error('Offline'));
	const screen = await render(FocusTimer, { today: true });
	await screen.getByRole('combobox', { name: 'Mode' }).selectOptions('hourglass');
	await screen.getByRole('combobox', { name: 'Work on' }).selectOptions('');
	await screen.getByText('Timer settings', { exact: true }).click();
	await screen.getByRole('spinbutton', { name: 'Hourglass minutes' }).fill('12');
	await screen.getByRole('button', { name: 'Start hourglass · 12m' }).click();
	expect(api.start.mutate).toHaveBeenCalledWith(
		expect.objectContaining({ minutes: 12, intentionId: null, kind: 'hourglass' })
	);
	await expect.element(screen.getByRole('button', { name: 'Take long break · 20m' })).toBeVisible();
});

test('a failed initial sync has a working retry', async () => {
	api.state.query.mockRejectedValueOnce(new Error('Offline'));
	const screen = await render(FocusTimer, { today: true });
	await screen.getByRole('button', { name: 'Retry timer sync' }).click();
	await expect.element(screen.getByRole('button', { name: 'Start Pomodoro · 25m' })).toBeVisible();
});
