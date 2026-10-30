<script lang="ts">
	import type { Goal, Intention } from '#lib/trpc/types.js';
	import { goalColorForIntention, goalOrderNumberForId } from '#lib/utils/index.js';
	import { groupNotDones, intentionMatchKey, type NotDoneGroup } from '#lib/utils/notDones.js';
	import { notDoneSkips } from '#lib/stores/notDoneSkips.svelte.js';
	import { tick } from 'svelte';
	import { IsMounted } from 'runed';
	import Plus from 'virtual:icons/lucide/plus';
	import ChevronDown from 'virtual:icons/lucide/chevron-down';

	let {
		goals,
		today,
		recentIntentions,
		plannedIntentions,
		onImport
	}: {
		goals: Goal[];
		today: string;
		recentIntentions: Intention[];
		/** Items already on today's list (saved or drafted) — skipped items matching one are not re-offered. */
		plannedIntentions: Intention[];
		onImport: (line: string) => void;
	} = $props();

	const panelId = $props.id();
	const mounted = new IsMounted();
	let toggle = $state<HTMLButtonElement>();
	let feedback = $state('');
	let lastSkipped = $state<Intention | null>(null);
	let hidden = $state(false);
	let confirmGroup = $state<NotDoneGroup | null>(null);
	let strategy = $state('');
	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (confirmGroup && dialog && !dialog.open) dialog.showModal();
	});

	const focusToggle = () => void tick().then(() => toggle?.focus({ preventScroll: true }));
	const skip = (group: NotDoneGroup) => {
		notDoneSkips.skipToday(group.representative, today);
		lastSkipped = group.representative;
		feedback = `Skipped for today: ${group.representative.text}`;
		focusToggle();
	};
	const undoSkip = () => {
		if (!lastSkipped) return;
		notDoneSkips.restoreToday(lastSkipped, today);
		feedback = `Restored: ${lastSkipped.text}`;
		lastSkipped = null;
		focusToggle();
	};

	let groups = $derived.by(() => {
		const planned = new Set(plannedIntentions.map((i) => intentionMatchKey(i.goalId, i.text)));
		return groupNotDones(recentIntentions)
			.filter(
				(group) =>
					goals.some(
						(goal) =>
							goal.id === group.representative.goalId && goal.active === 1 && goal.orderNumber > 0
					) &&
					// Local preferences apply after hydration so the first client render
					// matches the server, which cannot read this browser's storage.
					(!mounted.current || !notDoneSkips.isSkipped(group.representative, today)) &&
					!planned.has(intentionMatchKey(group.representative.goalId, group.representative.text))
			)
			.sort(
				(a, b) =>
					b.representative.date.localeCompare(a.representative.date) ||
					goalOrderNumberForId(a.representative.goalId, goals) -
						goalOrderNumberForId(b.representative.goalId, goals)
			);
	});

	const codeFor = (group: NotDoneGroup) =>
		`${goalOrderNumberForId(group.representative.goalId, goals)}${group.representative.subIntentionQualifier ?? ''}${')'.repeat(1 + group.missCount)}`;

	const dayFor = (intention: Intention) =>
		new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(`${intention.date.slice(0, 10)}T00:00:00Z`)
		);

	const importGroup = (group: NotDoneGroup, strategyText = '') => {
		// Re-importing a propagated item must not stack another "⟶ strategy"
		// suffix onto the previous one.
		const base = group.representative.text.replace(/ ⟶ .*$/, '').trim();
		const text = strategyText ? `${base} ⟶ ${strategyText}` : base;
		onImport(
			`${goalOrderNumberForId(group.representative.goalId, goals)}${group.representative.subIntentionQualifier ?? ''}) ${text}`
		);
		feedback = `Added to your draft: ${base}`;
		lastSkipped = null;
		focusToggle();
	};

	const handleImport = (group: NotDoneGroup) => {
		if (group.missCount >= 2) {
			strategy = '';
			confirmGroup = group;
		} else {
			importGroup(group);
		}
	};

	// Cancel must do nothing: previously it marked the group not_today, the
	// opposite of what the button says.
	const handleCancel = () => {
		dialog?.close();
		confirmGroup = null;
		strategy = '';
	};

	const handleKeep = () => {
		if (!confirmGroup) return;
		importGroup(confirmGroup, strategy.trim());
		dialog?.close();
		confirmGroup = null;
		strategy = '';
	};
</script>

{#if groups.length > 0 || feedback}
	<section class="border-base-300 bg-base-200/40 rounded-field border p-3" aria-label="NotDones">
		<button
			bind:this={toggle}
			class="btn btn-ghost btn-sm w-full justify-start"
			aria-controls={panelId}
			aria-expanded={!hidden}
			onclick={() => (hidden = !hidden)}
		>
			<ChevronDown class="size-4 shrink-0 {hidden ? '-rotate-90' : ''}" />
			<span>NotDones</span>
			<span class="text-base-content/60 text-sm font-normal">{groups.length}</span>
			<span class="text-base-content/60 ms-auto text-sm font-normal"
				>{hidden ? 'Show' : 'Hide'}</span
			>
		</button>
		<div id={panelId} {hidden}>
			<p class="text-base-content/70 mt-1 text-sm">
				Unfinished or deferred from the last 3 days. Choose what to bring into today.
			</p>
			<ul class="divide-base-300 mt-2 max-h-64 divide-y overflow-y-auto overscroll-contain px-1">
				{#each groups as group (group.representative.id)}
					<li class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
						<div class="min-w-0 flex-1 basis-48">
							<p
								class="goal-text font-semibold wrap-anywhere"
								style="--goal-color: {goalColorForIntention(group.representative, goals)}"
							>
								{codeFor(group)}
								{group.representative.text}
							</p>
							<p class="text-base-content/60 mt-1 text-xs">
								{dayFor(group.representative)} · {group.representative.status === 'not_today'
									? 'Deferred'
									: 'Unfinished'}
								{#if group.missCount >= 2}
									· {group.missCount} unfinished days{/if}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<button
								class="btn btn-sm"
								aria-label="Add to today: {group.representative.text}"
								onclick={() => handleImport(group)}><Plus class="size-4" />Add to today</button
							>
							<button
								class="btn btn-ghost btn-sm"
								aria-label="Skip today: {group.representative.text}"
								title="Hide for today on this browser"
								onclick={() => skip(group)}>Skip today</button
							>
						</div>
					</li>
				{/each}
			</ul>
		</div>
		<div class="mt-1 text-sm wrap-anywhere" role="status">
			<span>{feedback}</span>
			{#if lastSkipped}<button class="btn btn-ghost btn-sm" onclick={undoSkip}>Undo skip</button
				>{/if}
		</div>
	</section>
{/if}

{#if confirmGroup}
	{@const group = confirmGroup}
	<dialog
		bind:this={dialog}
		class="modal"
		aria-labelledby="{panelId}-title"
		aria-describedby="{panelId}-item"
		oncancel={handleCancel}
		onclose={handleCancel}
	>
		<div class="modal-box">
			{#if group.missCount === 2}
				<h3 id="{panelId}-title" class="text-lg font-bold">
					You've skipped this twice. Maybe cancel & break it into subtasks?
				</h3>
			{:else}
				<h3 id="{panelId}-title" class="text-lg font-bold">
					You sure? {group.missCount}× skipped… If this is important, how are you going to make it
					happen today?
				</h3>
			{/if}
			<p
				id="{panelId}-item"
				class="goal-text my-3 text-lg font-bold wrap-anywhere"
				style="--goal-color: {goalColorForIntention(group.representative, goals)}"
			>
				{codeFor(group)}
				{group.representative.text}
			</p>
			{#if group.missCount >= 3}
				<input
					bind:value={strategy}
					class="input w-full"
					placeholder="How will you make it happen today?"
					aria-label="How will you make it happen today?"
				/>
			{/if}
			<div class="modal-action">
				<button class="btn btn-warning" onclick={handleCancel}>Cancel</button>
				<button
					class="btn btn-primary"
					disabled={group.missCount >= 3 && !strategy.trim()}
					onclick={handleKeep}>Keep</button
				>
			</div>
		</div>
		<button class="modal-backdrop" onclick={handleCancel}>close</button>
	</dialog>
{/if}

<style>
	.goal-text {
		color: oklch(from var(--goal-color) min(l, 0.48) c h);
	}
	:global([data-theme='dark']) .goal-text {
		color: oklch(from var(--goal-color) max(l, 0.78) c h);
	}
</style>
