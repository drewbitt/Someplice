<script lang="ts">
	import { trpc } from '#lib/trpc/client.js';
	import { notDones } from '#lib/stores/notDones.svelte.js';
	import { todayPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { goalColorForIntention, lightenHSL } from '#lib/utils/index.js';
	import { computeMissCount } from '#lib/utils/notDones.js';
	import { onMount, tick } from 'svelte';
	import { dndzone, SOURCES, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import Menu from 'virtual:icons/lucide/menu';
	import type { PageServerData } from '../../../routes/today/$types';
	import IntentionsModal from './IntentionsModal.svelte';

	let {
		goals,
		today,
		intentions = $bindable()
	}: {
		goals: PageServerData['goals'];
		today: string;
		intentions: PageServerData['intentions'];
	} = $props();

	type Intention = PageServerData['intentions'][0];

	let showIntentionModal = $state(false);
	// The open modal tracks its own intention id: rendering it under the hover
	// guard meant moving the mouse unmounted the dialog (and lost typed text).
	let modalIntentionId = $state<number | null>(null);

	let goalOrderNumbers = $derived(new Map(goals.map((goal) => [goal.id, goal.orderNumber])));

	const knownIntentions = $derived(
		intentions.filter((intention) => {
			const order = goalOrderNumbers.get(intention.goalId);
			return intention.goalId !== -1 && order !== undefined && order !== -1;
		})
	);
	// Only this derived view is overridden during dragging; the bound list stays saved data.
	let displayedIntentions = $derived(knownIntentions);

	onMount(() => {
		notDones.refresh().catch(() => {
			// Non-fatal: the panel and paren inflation just stay empty.
		});
	});

	let firstIncompleteIntentionIndex = $derived(
		displayedIntentions.findIndex(
			(intention) => intention.status === 'pending' && !inactiveGoalIds.has(intention.goalId)
		)
	);

	// Propagated items inflate their close parens per prior miss (6))) = 2 skips);
	// not-today items are marked with a leading dash instead.
	const intentionCode = (intention: Intention) => {
		const goalOrder = goalOrderNumbers.get(intention.goalId);
		const qualifier = intention.subIntentionQualifier ?? '';
		// x-prefixed: the goal is inactive, so its number isn't in today's editor.
		if (inactiveGoalIds.has(intention.goalId)) {
			return `x${goalOrder}${qualifier})`;
		}
		if (intention.status === 'not_today') {
			return `-${goalOrder}${qualifier})`;
		}
		const misses = computeMissCount(notDones.recentIntentions, intention.goalId, intention.text);
		return `${goalOrder}${qualifier}${')'.repeat(1 + misses)}`;
	};

	let inactiveGoalIds = $derived(
		new Set(
			goals
				.filter((goal) => goal.active === 0)
				.map((goal) => goal.id)
				.filter((id): id is number => id !== null)
		)
	);

	let saving = $state(false);
	let dragging = $state(false);

	const updateIntention = async (original: Intention, status: 'done' | 'pending') => {
		const id = original.id;
		if (id === null || saving || dragging) return false;
		const requestDay = today;
		const focused = document.activeElement;
		const restoreFocus =
			focused instanceof HTMLElement &&
			(focused.id === `intention-text-${id}` || focused.id === `intention-${id}`);
		saving = true;
		try {
			const updated = await trpc().intentions.setCompletion.mutate({
				id,
				completed: status === 'done'
			});
			if (today === requestDay) intentions = updated;
			return true;
		} catch (error) {
			todayPageErrorStore.setError(
				error instanceof Error ? error.message : 'Could not update intention.'
			);
		} finally {
			saving = false;
			await tick();
			if (restoreFocus && focused.isConnected && document.activeElement === document.body) {
				focused.focus({ preventScroll: true });
			}
		}
		return false;
	};

	const lighterGoalColorForIntention = (goalColor: string) => {
		if (goalColor === 'black') {
			return 'grey';
		}
		return lightenHSL(goalColor, 0.2);
	};

	const handleDndConsider = (event: CustomEvent<DndEvent<Intention>>) => {
		if (event.detail.info.trigger === TRIGGERS.DRAG_STOPPED) {
			dragging = false;
			return;
		}
		if (saving) return;
		dragging = true;
		displayedIntentions = event.detail.items;
	};

	const handleDndFinalize = async (event: CustomEvent<DndEvent<Intention>>) => {
		if (event.detail.info.source === SOURCES.POINTER) dragging = false;
		if (saving) return;
		const requestDay = today;
		displayedIntentions = event.detail.items;
		saving = true;
		try {
			const updated = await trpc().intentions.reorder.mutate(
				event.detail.items.map(({ id }, index) => ({ id: id!, orderNumber: index + 1 }))
			);
			if (today === requestDay) intentions = updated;
		} catch (error) {
			todayPageErrorStore.setError(
				error instanceof Error ? error.message : 'Could not reorder intentions.'
			);
		} finally {
			displayedIntentions = knownIntentions;
			saving = false;
		}
	};
</script>

<div class="rounded-box bg-base-100 shadow-sm">
	<div class="flex flex-col gap-1.5">
		{#if intentions.length > 0}
			<div class="mb-5 flex flex-wrap gap-x-5 pl-12">
				<h2 class="text-2xl font-bold text-gray-700 tabular-nums dark:text-purple-200">
					{intentions.length}
					{intentions.length === 1 ? 'intention' : 'intentions'} for today,
				</h2>
				<h2 class="text-base-content/60 text-2xl font-bold tabular-nums">
					{(() => {
						const formatter = new Intl.DateTimeFormat('en-US', {
							weekday: 'long',
							month: 'short',
							day: 'numeric',
							timeZone: 'UTC'
						});
						return formatter.format(new Date(today));
					})()}
				</h2>
			</div>
		{/if}
		<div
			role="list"
			class="overflow-hidden"
			use:dndzone={{ items: displayedIntentions, dragDisabled: saving }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each displayedIntentions as intention, index (intention.id)}
				<span
					role="listitem"
					aria-label="{intentionCode(intention)} {intention.text}"
					aria-current={index === firstIncompleteIntentionIndex ? 'step' : undefined}
					style="--goal-color: {goalColorForIntention(intention, goals)}"
					class:current-intention={index === firstIncompleteIntentionIndex}
					class={'intention-row flex items-center border-l-4 border-transparent py-1 pr-3 pl-2' +
						(intention.status === 'done' ? ' line-through' : '') +
						(index === firstIncompleteIntentionIndex ? ' mb-1' : '')}
				>
					{#if showIntentionModal && modalIntentionId === intention.id}
						<IntentionsModal bind:opened={showIntentionModal} {intention} {goals} />
					{/if}
					<button
						type="button"
						disabled={saving || dragging}
						aria-haspopup="dialog"
						aria-label="Open intention menu"
						class="hover:bg-base-300 flex size-8 shrink-0 items-center justify-center rounded-sm opacity-60 hover:opacity-100 focus-visible:opacity-100"
						onclick={() => {
							modalIntentionId = intention.id;
							showIntentionModal = true;
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"
							><g
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								><circle cx="8" cy="2.5" r=".75" /><circle cx="8" cy="8" r=".75" /><circle
									cx="8"
									cy="13.5"
									r=".75"
								/></g
							></svg
						>
					</button>
					<Menu class="hidden w-4 shrink-0 opacity-40 sm:block" aria-hidden="true" />
					<input
						tabindex={-1}
						id="intention-{intention.id}"
						aria-labelledby="intention-text-{intention.id}"
						type="checkbox"
						class={index === firstIncompleteIntentionIndex
							? 'checkbox-md ml-0.5'
							: 'checkbox-sm ml-0.5'}
						disabled={saving || dragging}
						checked={intention.status === 'done'}
						onchange={async (event) => {
							const checkbox = event.currentTarget;
							const saved = await updateIntention(intention, checkbox.checked ? 'done' : 'pending');
							if (!saved) checkbox.checked = intention.status === 'done';
						}}
					/>
					<button
						type="button"
						aria-pressed={intention.status === 'done'}
						id="intention-text-{intention.id}"
						disabled={saving || dragging}
						onclick={() =>
							updateIntention(intention, intention.status === 'done' ? 'pending' : 'done')}
						oncontextmenu={(e) => {
							e.preventDefault();
							modalIntentionId = intention.id;
							showIntentionModal = true;
						}}
						onkeydown={(e) => {
							if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
								e.preventDefault();
								modalIntentionId = intention.id;
								showIntentionModal = true;
							}
						}}
						class="goal-text ml-2 min-h-8 min-w-0 py-0.5 text-left break-words {index ===
						firstIncompleteIntentionIndex
							? 'text-xl font-extrabold'
							: intention.status === 'done'
								? 'text-lg font-normal'
								: 'text-lg font-bold'} {intention.status === 'not_today' ||
						inactiveGoalIds.has(intention.goalId)
							? 'italic'
							: ''}"
						style="--goal-color: {intention.status === 'done'
							? lighterGoalColorForIntention(goalColorForIntention(intention, goals))
							: goalColorForIntention(intention, goals)}"
						>{intentionCode(intention)} {intention.text}</button
					>
				</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.intention-row .goal-text {
		/* Keep goal hues brighter than the previous blanket 0.5 lightness cap.
		   The larger, bold current item can carry more of the original color. */
		color: oklch(from var(--goal-color) min(l, var(--intention-lightness, 0.55)) c h);
	}

	:global([data-theme='dark']) .intention-row .goal-text {
		color: oklch(from var(--goal-color) max(l, 0.7) c h);
	}

	.current-intention {
		--intention-lightness: 0.6;
		background-color: color-mix(in srgb, var(--goal-color) 6%, var(--color-base-100));
		border-left-color: var(--goal-color);
		border-radius: 0.25rem;
	}
</style>
