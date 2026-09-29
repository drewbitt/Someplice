<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import type { PageServerData } from '../../../routes/goals/$types';
	import GenericModal from '../shared/GenericModal.svelte';
	import GoalDateDisplay from './GoalDateDisplay.svelte';
	import GoalDescription from './GoalDescription.svelte';
	import GoalTitleRow from './GoalTitleRow.svelte';
	import PriorityModal from '../shared/PriorityModal.svelte';
	import type { Priority } from '$src/lib/trpc/types';
	import { goalPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { readableTextColor } from '$src/lib/utils';

	let {
		goal = $bindable(),
		currentlyEditing,
		priority,
		isInactiveGoal = false
	}: {
		goal: PageServerData['goals'][0];
		currentlyEditing: boolean;
		priority?: Priority | null;
		isInactiveGoal?: boolean;
	} = $props();

	let showDeletionPrompt = $state(false);
	let deletionConfirmed = $state(false);
	let showArchivePrompt = $state(false);
	let archiveConfirmed = $state(false);
	let showRestorePrompt = $state(false);
	let restoreConfirmed = $state(false);
	let showPriorityModal = $state(false);
	$effect(() => {
		if (deletionConfirmed) {
			deleteGoal();
		}
	});
	$effect(() => {
		if (archiveConfirmed) {
			archiveGoal();
		}
	});
	$effect(() => {
		if (restoreConfirmed) {
			restoreGoal();
		}
	});

	const handleDeleteGoal = async () => {
		if (goal.id) {
			showDeletionPrompt = true;
		}
	};
	const deleteGoal = async () => {
		if (goal.id) {
			try {
				const deleteResult = await trpc().goals.delete.mutate(goal.id);
				if (deleteResult.length > 0) {
					await invalidateAll();
				}
			} catch (error: unknown) {
				if (error instanceof Error) {
					goalPageErrorStore.setError(error.message);
				}
			}
		}
	};
	const handleArchiveGoal = async () => {
		if (goal.id) {
			showArchivePrompt = true;
		}
	};
	const archiveGoal = async () => {
		if (goal.id) {
			try {
				const archiveResult = await trpc().goals.archive.mutate(goal.id);
				if (archiveResult[0]?.numUpdatedRows !== undefined && archiveResult[0].numUpdatedRows > 0) {
					await invalidateAll();
				}
			} catch (error: unknown) {
				if (error instanceof Error) {
					goalPageErrorStore.setError(error.message);
				}
			}
		}
	};
	const handleRestoreGoal = async () => {
		if (goal.id) {
			showRestorePrompt = true;
		}
	};
	const restoreGoal = async () => {
		if (goal.id) {
			try {
				await trpc().goals.restore.mutate(goal.id);
				await invalidateAll();
			} catch (error: unknown) {
				if (error instanceof Error) {
					goalPageErrorStore.setError(error.message);
				}
			}
		}
	};

	const openPriorityModal = () => {
		showPriorityModal = true;
	};
</script>

<div role="listitem">
	<div
		style="background-color: {goal.color}"
		class="mx-5 grid auto-rows-[6rem] grid-cols-[minmax(0,3rem)_4fr] gap-4 leading-none"
	>
		<span class="pl-2 font-mono text-7xl" style="color: {readableTextColor(goal.color)}">
			{goal.active ? goal.orderNumber : 'X'}
		</span>
		{#if showDeletionPrompt}
			<GenericModal
				bind:showModal={showDeletionPrompt}
				bind:actionConfirmed={deletionConfirmed}
				title="Delete Goal"
				message="Are you sure you want to delete this goal? This action is irreversible and will delete all associated history with this goal."
				action="Delete"
				actionButtonClass="btn btn-error"
			/>
		{/if}
		{#if showArchivePrompt}
			<GenericModal
				bind:showModal={showArchivePrompt}
				bind:actionConfirmed={archiveConfirmed}
				title="Archive Goal"
				message="Are you sure you want to archive this goal?"
				action="Archive"
				actionButtonClass="btn btn-accent"
			/>
		{/if}
		{#if showRestorePrompt}
			<GenericModal
				bind:showModal={showRestorePrompt}
				bind:actionConfirmed={restoreConfirmed}
				title="Restore Goal"
				message="Are you sure you want to restore this goal?"
				action="Restore"
				actionButtonClass="btn btn-accent"
			/>
		{/if}
		<div class="goal-box-details flex flex-col gap-1">
			<GoalTitleRow
				bind:title={goal.title}
				{currentlyEditing}
				{isInactiveGoal}
				bind:goalColor={goal.color}
			/>
			<GoalDescription
				bind:description={goal.description}
				goalColor={goal.color}
				{currentlyEditing}
				{handleDeleteGoal}
				{handleArchiveGoal}
				{isInactiveGoal}
				{handleRestoreGoal}
			/>
		</div>
	</div>
	{#if !isInactiveGoal}
		<button
			class="mx-5 block w-[calc(100%-2.5rem)] truncate rounded-md px-3 py-1.5 text-left font-semibold hover:underline"
			style="background-color: color-mix(in srgb, {goal.color} 12%, transparent); color: color-mix(in srgb, {goal.color} 65%, var(--color-base-content))"
			onclick={openPriorityModal}
		>
			Top Priority | {priority?.text ?? '+'}{#if priority?.checkInDate}
				| by {priority.checkInDate}{/if}
		</button>
		{#if showPriorityModal}
			<PriorityModal
				bind:showModal={showPriorityModal}
				{goal}
				{priority}
				onError={(message) => goalPageErrorStore.setError(message)}
			/>
		{/if}
	{:else}
		<GoalDateDisplay {goal} />
	{/if}
</div>
