<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';
	import {
		goalColorForIntention,
		goalOrderNumberForId,
		groupNotDones,
		intentionMatchKey,
		type IntentionRow,
		type NotDoneGroup
	} from '$src/lib/utils';
	import { notDones } from '$src/lib/stores/notDones.svelte';
	import { todayPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { onMount } from 'svelte';
	import Trash2 from 'virtual:icons/lucide/trash-2';

	let {
		goals,
		plannedIntentions,
		onImport
	}: {
		goals: Goal[];
		/** Items already on today's list (saved or drafted) — skipped items matching one are not re-offered. */
		plannedIntentions: IntentionRow[];
		onImport: (line: string) => void;
	} = $props();

	let hidden = $state(false);
	let confirmGroup = $state<NotDoneGroup | null>(null);
	let strategy = $state('');

	onMount(() => {
		if (!notDones.loaded) {
			notDones.refresh().catch((error) => {
				if (error instanceof Error) todayPageErrorStore.setError(error.message);
			});
		}
	});

	let groups = $derived.by(() => {
		const planned = new Set(plannedIntentions.map((i) => intentionMatchKey(i.goalId, i.text)));
		return groupNotDones(notDones.recentIntentions)
			.filter(
				(group) =>
					goalOrderNumberForId(group.representative.goalId, goals) !== -1 &&
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

	const dayFor = (intention: IntentionRow) =>
		new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(
			new Date(`${intention.date.slice(0, 10)}T00:00:00Z`)
		);

	const markGroupNotToday = async (group: NotDoneGroup) => {
		try {
			const intentions = group.occurrences.map((intention) => ({
				...intention,
				status: 'not_today' as const
			}));
			await trpc().intentions.updateIntentions.mutate({ intentions });
			notDones.markStatuses(
				group.occurrences.map((i) => i.id),
				'not_today'
			);
		} catch (error) {
			if (error instanceof Error) {
				todayPageErrorStore.setError(error.message);
			}
		}
	};

	const importGroup = (group: NotDoneGroup, strategyText = '') => {
		const text = strategyText
			? `${group.representative.text} — ${strategyText}`
			: group.representative.text;
		onImport(
			`${goalOrderNumberForId(group.representative.goalId, goals)}${group.representative.subIntentionQualifier ?? ''}) ${text}`
		);
	};

	const handleImport = (group: NotDoneGroup) => {
		if (group.missCount >= 2) {
			strategy = '';
			confirmGroup = group;
		} else {
			importGroup(group);
		}
	};

	const handleCancel = async () => {
		const group = confirmGroup;
		confirmGroup = null;
		strategy = '';
		if (group) await markGroupNotToday(group);
	};

	const handleKeep = () => {
		if (!confirmGroup) return;
		importGroup(confirmGroup, strategy.trim());
		confirmGroup = null;
		strategy = '';
	};
</script>

{#if groups.length > 0}
	<div
		class="rounded-field border border-amber-300/70 bg-amber-50 p-2 dark:border-amber-700/50 dark:bg-amber-950/40"
	>
		<button
			class="btn btn-ghost btn-sm text-amber-800 dark:text-amber-200"
			onclick={() => (hidden = !hidden)}
		>
			{hidden ? '⌄ Show NotDones' : '⌃ Hide NotDones'}
		</button>
		{#if !hidden}
			<ul class="mt-1 flex flex-col gap-1">
				{#each groups as group (group.representative.id)}
					<li class="flex items-center gap-1">
						<button
							class="btn btn-ghost btn-xs"
							aria-label="Import {group.representative.text} into today"
							title="Import into today"
							onclick={() => handleImport(group)}>⬇</button
						>
						<span
							class="goal-text truncate text-lg font-bold"
							style="--goal-color: {goalColorForIntention(group.representative, goals)}"
							>{codeFor(group)} {group.representative.text}</span
						>
						<span class="text-base-content/50 ms-1 text-sm">{dayFor(group.representative)}</span>
						<button
							class="btn btn-ghost btn-xs ms-auto"
							aria-label="Dismiss {group.representative.text}"
							title="Not today"
							onclick={() => markGroupNotToday(group)}><Trash2 /></button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if confirmGroup}
	{@const group = confirmGroup}
	<dialog class="modal modal-open">
		<div class="modal-box">
			{#if group.missCount === 2}
				<h3 class="text-lg font-bold">
					You've skipped this twice. Maybe cancel & break it into subtasks?
				</h3>
			{:else}
				<h3 class="text-lg font-bold">
					You sure? {group.missCount}× skipped… If this is important, how are you going to make it
					happen today?
				</h3>
			{/if}
			<p
				class="goal-text my-3 text-lg font-bold"
				style="--goal-color: {goalColorForIntention(group.representative, goals)}"
			>
				{codeFor(group)}
				{group.representative.text}
			</p>
			{#if group.missCount >= 3}
				<input
					bind:value={strategy}
					class="input input-bordered w-full"
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
		<button class="modal-backdrop" onclick={() => (confirmGroup = null)}>close</button>
	</dialog>
{/if}
