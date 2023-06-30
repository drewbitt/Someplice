<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { cssvariable } from '@svelteuidev/composables';
	import { Box, createStyles, Stack } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/goals/$types';
	import GenericModal from '../shared/GenericModal.svelte';
	import GoalDateDisplay from './GoalDateDisplay.svelte';
	import GoalDescription from './GoalDescription.svelte';
	import GoalTitleRow from './GoalTitleRow.svelte';

	export let goal: PageServerData['goals'][0];
	export let currentlyEditing: boolean;
	export let showDates: boolean = false;

	let goalColor = goal.color;
	$: goal.color = goalColor;
	let showDeletionPrompt = false;
	let deletionConfirmed = false;
	let showArchivePrompt = false;
	let archiveConfirmed = false;
	$: if (deletionConfirmed) {
		deleteGoal();
	}
	$: if (archiveConfirmed) {
		archiveGoal();
	}

	const handleDeleteGoal = async () => {
		if (goal.id) {
			// Prompt user to confirm deletion
			showDeletionPrompt = true;
		}
	};
	const deleteGoal = async () => {
		if (goal.id) {
			const deleteResult = await trpc($page).goals.delete.mutate(goal.id);
			if (deleteResult.length > 0) {
				await invalidateAll();
			}
		}
	};
	const handleArchiveGoal = async () => {
		if (goal.id) {
			// Prompt user to confirm archive
			showArchivePrompt = true;
		}
	};
	const archiveGoal = async () => {
		if (goal.id) {
			const archiveResult = await trpc($page).goals.archive.mutate(goal.id);
			if (archiveResult.length > 0) {
				await invalidateAll();
			}
		}
	};

	const darkModeStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'white'
			}
		}
	}));
	$: ({ getStyles } = darkModeStyles());
</script>

<div role="listitem" class="mb-2.5">
	<div
		style="background-color: {goalColor}"
		use:cssvariable={{ 'goal-color': goalColor }}
		class="goal-box mt-2.5 mx-5 grid"
	>
		<Box root="span" class="font-mono text-7xl {getStyles()}" className="goal-box-number">
			{goal.orderNumber}
		</Box>
		{#if showDeletionPrompt}
			<GenericModal
				bind:showModal={showDeletionPrompt}
				bind:actionConfirmed={deletionConfirmed}
				title="Delete Goal"
				message="Are you sure you want to delete this goal? This action is irreversible."
				action="Delete"
				actionButtonClass="daisy-btn daisy-btn-error"
			/>
		{/if}
		{#if showArchivePrompt}
			<GenericModal
				bind:showModal={showArchivePrompt}
				bind:actionConfirmed={archiveConfirmed}
				title="Archive Goal"
				message="Are you sure you want to archive this goal? This action is reversible."
				action="Archive"
				actionButtonClass="daisy-btn daisy-btn-accent"
			/>
		{/if}
		<Stack className="goal-box-details" spacing="xs">
			<GoalTitleRow bind:title={goal.title} {currentlyEditing} bind:goalColor />
			<GoalDescription
				bind:description={goal.description}
				{currentlyEditing}
				{handleDeleteGoal}
				{handleArchiveGoal}
			/>
		</Stack>
	</div>
	{#if showDates}
		<GoalDateDisplay {goal} />
	{/if}
</div>

<style>
	.goal-box {
		gap: 1rem;
		/* minimum width of 0 */
		grid-template-columns: minmax(0, 3rem) 4fr;
		grid-auto-rows: 6rem;
		line-height: 1;
		background-color: var(--goal-color);
	}
</style>
