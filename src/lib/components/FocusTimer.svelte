<script lang="ts">
	import { onMount } from 'svelte';
	import { trpc } from '#lib/trpc/client.js';
	import type { RouterOutputs, RouterInputs } from '#lib/trpc/router.js';
	import { createSessionId, elapsedSeconds, formatClock } from '#lib/focus.js';
	import Timer from 'virtual:icons/lucide/timer';

	let { today = false, refreshKey = null }: { today?: boolean; refreshKey?: unknown } = $props();
	type Snapshot = RouterOutputs['focus']['state'];
	type StartInput = RouterInputs['focus']['start'];
	let timerState = $state<Snapshot | null>(null);
	let preferences = $state({
		workMinutes: 25,
		hourglassMinutes: 25,
		shortBreakMinutes: 5,
		longBreakMinutes: 20
	});
	let mode = $state<'pomodoro' | 'hourglass'>('pomodoro');
	let selection = $state<string | null>(null);
	let mounted = $state(false);
	let pending = $state(false);
	let loadError = $state('');
	let error = $state('');
	let clock = $state(0);
	let offset = $state(0);
	let announcement = $state('');
	let cancelDialog: HTMLDialogElement;
	let cancelTarget: { id: string; revision: number } | null = null;
	let fetching = false;
	let generation = 0;
	let initializedPreferences = false;
	let retryStart: StartInput | null = null;
	const headingId = $props.id();
	let active = $derived(timerState?.active);
	let remaining = $derived(
		active ? active.plannedSeconds - elapsedSeconds(active, clock + offset) : 0
	);
	let selectedId = $derived(
		selection === null ? String(timerState?.intentions[0]?.id ?? '') : selection
	);
	let last = $derived(timerState?.latest);
	let justFinished = $derived(
		!active && last?.status === 'completed' && last.day === timerState?.day
	);
	let longBreakDue = $derived(
		(timerState?.totals.pomodoros ?? 0) > 0 && (timerState?.totals.pomodoros ?? 0) % 4 === 0
	);

	function accept(next: Snapshot) {
		const previous = timerState?.active;
		if (previous && !next.active && next.latest?.id === previous.id) {
			announcement =
				next.latest.status === 'completed'
					? previous.kind === 'hourglass'
						? 'Hourglass time saved.'
						: `${previous.kind === 'break' ? 'Break' : 'Pomodoro'} complete.`
					: previous.kind === 'break'
						? 'Break skipped.'
						: 'Pomodoro cancelled.';
		}
		timerState = next;
		if (
			selection &&
			!next.active &&
			!next.intentions.some((item) => String(item.id) === selection)
		) {
			selection = null;
		}
		clock = Date.now();
		offset = next.now - clock;
		loadError = '';
		if (!initializedPreferences) {
			preferences = { ...next.preferences };
			initializedPreferences = true;
		}
	}

	async function refresh() {
		if (fetching || pending) return;
		fetching = true;
		const request = generation;
		try {
			const next = await trpc().focus.state.query();
			if (request === generation) accept(next);
		} catch {
			if (request === generation) loadError = 'Could not sync the timer. Reconnect and retry.';
		} finally {
			fetching = false;
		}
	}

	$effect(() => {
		void refreshKey;
		if (mounted) void refresh();
	});

	onMount(() => {
		mounted = true;
		const tick = window.setInterval(() => {
			clock = Date.now();
			if (active?.status === 'running' && remaining <= 0) void refresh();
		}, 1000);
		const poll = window.setInterval(() => {
			if (document.visibilityState === 'visible') void refresh();
		}, 5000);
		const onReturn = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		document.addEventListener('visibilitychange', onReturn);
		window.addEventListener('online', onReturn);
		return () => {
			clearInterval(tick);
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onReturn);
			window.removeEventListener('online', onReturn);
		};
	});

	async function start(kind: StartInput['kind'], minutes: number | undefined) {
		if (pending || active) return;
		if (
			!Number.isInteger(minutes) ||
			!minutes ||
			minutes < 1 ||
			minutes > 180 ||
			Object.values(preferences).some(
				(value) => !Number.isInteger(value) || value < 1 || value > 180
			)
		) {
			error = 'Choose whole minutes from 1 to 180.';
			return;
		}
		const payload = {
			kind,
			minutes,
			intentionId: kind === 'break' || !selectedId ? null : Number(selectedId),
			preferences: { ...preferences }
		};
		// Reuse the request ID when retrying the same start after a lost response.
		const prior = retryStart;
		retryStart =
			prior && JSON.stringify({ ...prior, id: undefined }) === JSON.stringify(payload)
				? prior
				: { ...payload, id: createSessionId() };
		pending = true;
		error = '';
		generation++;
		try {
			accept(await trpc().focus.start.mutate(retryStart));
			retryStart = null;
			announcement = `${kind === 'break' ? 'Break' : kind === 'pomodoro' ? 'Pomodoro' : 'Hourglass'} started.`;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not start timer.';
		} finally {
			pending = false;
			void refresh();
		}
	}

	async function control(action: RouterInputs['focus']['control']['action'], target = active) {
		if (!target || pending) return;
		pending = true;
		error = '';
		generation++;
		try {
			accept(
				await trpc().focus.control.mutate({ id: target.id, revision: target.revision, action })
			);
			if (action === 'pause') announcement = 'Hourglass paused.';
			if (action === 'resume') announcement = 'Hourglass resumed.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not update timer.';
		} finally {
			pending = false;
			void refresh();
		}
	}

	function askToCancel() {
		if (!active) return;
		cancelTarget = { id: active.id, revision: active.revision };
		cancelDialog.showModal();
	}
	function confirmCancel() {
		const target = cancelTarget;
		cancelDialog.close();
		// A timer finishing or another device starting one while the dialog was
		// open must never make this button cancel that newer session.
		if (target && active?.id === target.id && active.revision === target.revision)
			void control('cancel');
	}
</script>

<p role="status" class="sr-only">{announcement}</p>
{#if today || active}
	<section
		aria-labelledby={headingId}
		class="border-base-300 bg-base-200/50 mb-4 rounded-xl border p-3 sm:p-4"
	>
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex min-w-0 basis-full items-center gap-3 sm:flex-1 sm:basis-0">
				<Timer class="size-5 shrink-0" aria-hidden="true" />
				<div class="min-w-0">
					<h2 id={headingId} class="font-semibold">
						{active
							? active.kind === 'break'
								? 'Break'
								: active.kind === 'pomodoro'
									? 'Pomodoro'
									: 'Hourglass'
							: 'Focus timer'}
					</h2>
					{#if active}
						<p class="text-base-content/75 text-sm break-words">
							{active.kind === 'break'
								? 'Step away and recharge.'
								: (active.intentionText ?? 'Unassigned session')}{active.status === 'paused'
								? ' · Paused'
								: ''}
						</p>
						{#if timerState && active.day !== timerState.day}<p
								class="text-base-content/75 text-xs"
							>
								Started {active.day}
							</p>{/if}
					{:else if timerState}
						<p class="text-base-content/75 text-sm">
							{timerState.totals.pomodoros}
							{timerState.totals.pomodoros === 1 ? 'Pomodoro' : 'Pomodoros'} · {Math.floor(
								timerState.totals.seconds / 60
							)} min recorded today
						</p>
					{/if}
				</div>
			</div>
			{#if active}
				<span role="timer" aria-label="Time remaining" class="text-3xl font-semibold tabular-nums"
					>{formatClock(remaining)}</span
				>
				<div class="flex flex-wrap gap-2">
					{#if active.kind === 'hourglass'}
						<button
							type="button"
							class="btn btn-sm"
							disabled={pending}
							onclick={() => control(active?.status === 'paused' ? 'resume' : 'pause')}
							>{active.status === 'paused' ? 'Resume' : 'Pause'}</button
						>
						<button
							type="button"
							class="btn btn-sm"
							disabled={pending}
							onclick={() => control('stop')}>Save & stop</button
						>
					{:else if active.kind === 'pomodoro'}
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							disabled={pending}
							onclick={askToCancel}>Cancel Pomodoro</button
						>
					{:else}
						<button
							type="button"
							class="btn btn-sm btn-ghost"
							disabled={pending}
							onclick={() => control('cancel')}>Skip break</button
						>
					{/if}
					{#if !today}<a href="/today" class="btn btn-sm">Today</a>{/if}
				</div>
			{/if}
		</div>
		{#if !timerState}
			<p class="mt-2 text-sm">{loadError ? 'Timer unavailable.' : 'Loading timer…'}</p>
		{:else if today && !active}
			{#if justFinished}
				<p class="mt-3 text-sm font-medium">
					{last?.kind === 'break'
						? 'Break complete. Ready when you are.'
						: last?.kind === 'pomodoro'
							? 'Pomodoro complete. Time for a break?'
							: 'Hourglass time saved. Take a breather?'}
				</p>
			{/if}
			<form
				class="mt-3 flex flex-wrap items-end gap-2"
				onsubmit={(event) => {
					event.preventDefault();
					void start(
						mode,
						mode === 'pomodoro' ? preferences.workMinutes : preferences.hourglassMinutes
					);
				}}
			>
				<label class="flex flex-col gap-1 text-sm"
					>Mode
					<select
						class="border-base-300 bg-base-100 min-h-10 rounded-lg border px-2"
						bind:value={mode}
						disabled={pending}
					>
						<option value="pomodoro">Pomodoro</option><option value="hourglass">Hourglass</option>
					</select>
				</label>
				<label class="flex min-w-0 flex-1 basis-40 flex-col gap-1 text-sm sm:basis-64"
					>Work on
					<select
						class="border-base-300 bg-base-100 min-h-10 w-full min-w-0 rounded-lg border px-2"
						value={selectedId}
						onchange={(event) => {
							selection = event.currentTarget.value;
						}}
						disabled={pending}
					>
						<option value="">Unassigned</option>
						{#each timerState.intentions as intention (intention.id)}<option
								value={String(intention.id)}>{intention.text} · {intention.goalTitle}</option
							>{/each}
					</select>
				</label>
				<button type="submit" class="btn btn-primary min-h-10" disabled={pending}
					>Start {mode === 'pomodoro' ? 'Pomodoro' : 'hourglass'} · {mode === 'pomodoro'
						? preferences.workMinutes
						: preferences.hourglassMinutes}m</button
				>
				<button
					type="button"
					class="btn btn-ghost min-h-10"
					disabled={pending}
					onclick={() =>
						start(
							'break',
							longBreakDue ? preferences.longBreakMinutes : preferences.shortBreakMinutes
						)}
					>Take {longBreakDue ? 'long ' : ''}break · {longBreakDue
						? preferences.longBreakMinutes
						: preferences.shortBreakMinutes}m</button
				>
			</form>
			<p class="text-base-content/75 mt-2 text-sm">
				{mode === 'pomodoro'
					? 'One uninterrupted block. Cancelling earns no Pomodoro.'
					: 'Pause when needed. Save any time worked, even if you stop early.'}
			</p>
			<details class="mt-2 text-sm">
				<summary class="w-fit rounded-sm py-1">Timer settings</summary>
				<fieldset class="mt-2 flex flex-wrap gap-3" disabled={pending}>
					{#each [['workMinutes', 'Pomodoro'], ['hourglassMinutes', 'Hourglass'], ['shortBreakMinutes', 'Short break'], ['longBreakMinutes', 'Long break']] as [key, label] (key)}
						<label class="flex flex-col gap-1"
							>{label} minutes<input
								class="input input-sm w-24"
								type="number"
								min="1"
								max="180"
								step="1"
								bind:value={preferences[key as keyof typeof preferences]}
								required
							/></label
						>
					{/each}
				</fieldset>
				<p class="text-base-content/75 mt-2">
					Settings apply to your next timer and save when you start it. Choose each work block and
					break yourself.
				</p>
				<button
					type="button"
					class="btn btn-sm btn-ghost mt-2"
					disabled={pending}
					onclick={() => start('break', preferences.longBreakMinutes)}
					>Start long break · {preferences.longBreakMinutes}m</button
				>
			</details>
		{/if}
		{#if today && timerState && timerState.recent.length > 0}
			<details class="mt-3 text-sm">
				<summary class="w-fit rounded-sm py-1">Today's sessions</summary>
				<ul class="mt-2 space-y-2">
					{#each timerState.recent as session (session.id)}
						<li class="flex flex-wrap justify-between gap-x-3">
							<span class="min-w-0 break-words"
								>{session.kind === 'break' ? 'Break' : (session.intentionText ?? 'Unassigned')}
								<span class="text-base-content/75"
									>· {session.kind === 'pomodoro'
										? 'Pomodoro'
										: session.kind === 'hourglass'
											? 'Hourglass'
											: 'Rest'}</span
								></span
							><span class="shrink-0 tabular-nums"
								>{session.status === 'cancelled'
									? session.kind === 'break'
										? 'Skipped'
										: 'Interrupted · no credit'
									: formatClock(session.elapsedSeconds)}</span
							>
						</li>
					{/each}
				</ul>
				{#if timerState.recent.length === 20}<p class="mt-2">
						Showing the 20 most recent sessions. Totals include the full day.
					</p>{/if}
			</details>
		{/if}
		{#if error}<p role="alert" class="text-error mt-2 text-sm">{error}</p>{/if}
		{#if loadError}<p role="alert" class="mt-2 text-sm">
				{loadError}
				<button type="button" class="underline" disabled={pending} onclick={refresh}
					>Retry timer sync</button
				>
			</p>{/if}
	</section>
{/if}
<dialog bind:this={cancelDialog} class="modal" aria-labelledby="{headingId}-cancel">
	<div class="modal-box">
		<h2 id="{headingId}-cancel" class="text-lg font-bold">Cancel this Pomodoro?</h2>
		<p class="mt-2">
			This unfinished block won't count as a completed Pomodoro. Your intention will stay as it is.
		</p>
		<div class="modal-action">
			<button type="button" class="btn" onclick={() => cancelDialog.close()}>Keep working</button>
			<button type="button" class="btn btn-error" onclick={confirmCancel}>Cancel Pomodoro</button>
		</div>
	</div>
</dialog>
