<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { appLogger } from '$src/lib/utils/logger';
	import { cssvariable } from '@svelteuidev/composables';
	import { Box, createStyles, Stack } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/goals/$types';
	import GenericModal from '../shared/GenericModal.svelte';
	import GoalDateDisplay from './GoalDateDisplay.svelte';
	import GoalDescription from './GoalDescription.svelte';
	import GoalTitleRow from './GoalTitleRow.svelte';

	export let goal: PageServerData['goals'][0];
	export let currentlyEditing: boolean;
	export let isInactiveGoal = false;

	let goalColor = goal.color;
	$: goal.color = goalColor;
	let showDeletionPrompt = false;
	let deletionConfirmed = false;
	let showArchivePrompt = false;
	let archiveConfirmed = false;
	let showRestorePrompt = false;
	let restoreConfirmed = false;
	$: if (deletionConfirmed) {
		deleteGoal();
	}
	$: if (archiveConfirmed) {
		archiveGoal();
	}
	$: if (restoreConfirmed) {
		restoreGoal();
	}

	const handleDeleteGoal = async () => {
		if (goal.id) {
			// Prompt user to confirm deletion
			showDeletionPrompt = true;
		}
	};
	const deleteGoal = async () => {
		if (goal.id) {
			try {
				const deleteResult = await trpc($page).goals.delete.mutate(goal.id);
				if (deleteResult.length > 0) {
					await invalidateAll();
				}
			} catch (error) {
				// TODO: Show error to user
				appLogger.error(error);
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
			try {
				const archiveResult = await trpc($page).goals.archive.mutate(goal.id);
				if (archiveResult[0]?.numUpdatedRows !== undefined && archiveResult[0].numUpdatedRows > 0) {
					await invalidateAll();
				}
			} catch (error) {
				// TODO: Show error to user
				appLogger.error(error);
			}
		}
	};
	const handleRestoreGoal = async () => {
		if (goal.id) {
			// Let's show the user a prompt to confirm restoration
			showRestorePrompt = true;
		}
	};
	const restoreGoal = async () => {
		if (goal.id) {
			try {
				await trpc($page).goals.restore.mutate(goal.id);
				await invalidateAll();
			} catch (error) {
				// TODO: Show error to user
				appLogger.error(error);
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

<Box role="listitem">
	<div
		style="background-color: {goalColor}"
		use:cssvariable={{ 'goal-color': goalColor }}
		class="goal-box mx-5 grid"
	>
		<Box root="span" class="font-mono text-7xl {getStyles()} pl-2" className="goal-box-number">
			{goal.active ? goal.orderNumber : 'X'}
		</Box>
		{#if showDeletionPrompt}
			<GenericModal
				bind:showModal={showDeletionPrompt}
				bind:actionConfirmed={deletionConfirmed}
				title="Delete Goal"
				message="Are you sure you want to delete this goal? This action is irreversible and will delete all associated history with this goal."
				action="Delete"
				actionButtonClass="daisy-btn daisy-btn-error"
			/>
		{/if}
		{#if showArchivePrompt}
			<GenericModal
				bind:showModal={showArchivePrompt}
				bind:actionConfirmed={archiveConfirmed}
				title="Archive Goal"
				message="Are you sure you want to archive this goal?"
				action="Archive"
				actionButtonClass="daisy-btn daisy-btn-accent"
			/>
		{/if}
		{#if showRestorePrompt}
			<GenericModal
				bind:showModal={showRestorePrompt}
				bind:actionConfirmed={restoreConfirmed}
				title="Restore Goal"
				message="Are you sure you want to restore this goal?"
				action="Restore"
				actionButtonClass="daisy-btn daisy-btn-accent"
			/>
		{/if}
		<Stack className="goal-box-details" spacing="xs">
			<GoalTitleRow bind:title={goal.title} {currentlyEditing} {isInactiveGoal} bind:goalColor />
			<GoalDescription
				bind:description={goal.description}
				{currentlyEditing}
				{handleDeleteGoal}
				{handleArchiveGoal}
				{isInactiveGoal}
				{handleRestoreGoal}
			/>
		</Stack>
	</div>
	{#if isInactiveGoal}
		<GoalDateDisplay {goal} />
	{/if}
</Box>

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
