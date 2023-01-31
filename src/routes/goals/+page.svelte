<script lang="ts">
	import { page } from '$app/stores';
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { Button, Title } from '@svelteuidev/core';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import type { PageServerData } from './$types';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

	export let data: PageServerData;
	type Goals = (typeof data.goals)[0];

	let dragDisabled = true; // false when renumber button has been clicked
	let dragButtonEnabled = true; // controls disabled state of renumber button
	let editButtonActive = false; // true when edit button has been clicked
	let editButtonEnabled = true; // controls disabled state of edit button
	$: editButtonEnabled = dragDisabled;
	$: dragButtonEnabled = !editButtonActive;

	// Store backup goal colors which will be restored if the user cancels
	let backupGoalColors: string[] = [];

	function handleEditButtonClick() {
		if (editButtonActive) {
			// Update colors on screen via reassignment
			data.goals = data.goals.map((goal) => {
				return { ...goal, color: goal.color };
			});

			trpc($page).goals.updateGoals.mutate({ goals: data.goals });
		} else {
			backupGoalColors = data.goals.map((goal) => goal.color);
		}
		editButtonActive = !editButtonActive;
	}
	function handleCancelButtonClick() {
		data.goals = data.goals.map((goal, index) => {
			return { ...goal, color: backupGoalColors[index] };
		});
		editButtonActive = false;
	}

	// DnD
	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}
	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index + 1 };
		});
		data.goals = items;

		await trpc($page).goals.updateGoals.mutate({ goals: items });
	};
</script>

<div>
	<Title class="flex" color="white">
		Goals
		<div class="daisy-indicator">
			<span
				class={editButtonActive
					? 'daisy-indicator-item daisy-badge daisy-badge-secondary translate-x-1/4'
					: ''}
			/>
			{#if editButtonActive}
				<Button color="teal" class={'mx-2'} on:click={handleCancelButtonClick}>Cancel</Button>
			{/if}
			<Button
				class={'mx-2'}
				disabled={!editButtonEnabled}
				color={!editButtonEnabled ? 'gray' : 'blue'}
				on:click={handleEditButtonClick}
			>
				{editButtonActive ? 'Save' : 'Edit'}
			</Button>
		</div>
		<div class="daisy-indicator">
			<span
				class={dragDisabled
					? ''
					: 'daisy-indicator-item daisy-badge daisy-badge-secondary translate-x-1/4'}
			/>
			<Button
				class={'mx-2'}
				disabled={!dragButtonEnabled}
				color={!dragButtonEnabled ? 'gray' : 'blue'}
				on:click={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</Button>
		</div>
	</Title>
	<section
		class="overflow-hidden"
		use:dndzone={{ items: data.goals, dragDisabled }}
		on:consider={handleDndConsider}
		on:finalize={handleDndFinalize}
	>
		{#each data.goals as goal (goal)}
			<GoalBoxComponent bind:goal currentlyEditing={editButtonActive} />
		{/each}
	</section>
	<NewGoalBoxComponent />
</div>
