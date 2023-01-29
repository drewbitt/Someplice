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

	function handleEditButtonClick() {
		editButtonActive = !editButtonActive;
	}

	// DnD
	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}
	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index };
		});
		// Return if no changes
		if (JSON.stringify(items) === JSON.stringify(data.goals)) return;

		await trpc($page).goals.updateGoals.mutate({ goals: items });
	};
</script>

<div>
	<Title class="flex" color="white">
		Goals
		<div class="indicator">
			<span
				class={editButtonActive ? 'indicator-item badge badge-secondary translate-x-1/4' : ''}
			/>
			<Button
				class={'mx-2' + (editButtonEnabled ? '' : ' btn-disabled')}
				on:click={handleEditButtonClick}
			>
				{editButtonActive ? 'Save' : 'Edit'}
			</Button>
		</div>
		<div class="indicator">
			<span class={dragDisabled ? '' : 'indicator-item badge badge-secondary translate-x-1/4'} />
			<Button
				class={'mx-2' + (dragButtonEnabled ? '' : ' btn-disabled')}
				on:click={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</Button>
		</div>
	</Title>
	<section
		class="overflow-scroll"
		use:dndzone={{ items: data.goals, dragDisabled }}
		on:consider={handleDndConsider}
		on:finalize={handleDndFinalize}
	>
		{#each data.goals as goal (goal.orderNumber)}
			<GoalBoxComponent {goal} />
		{/each}
	</section>
	<NewGoalBoxComponent />
</div>
