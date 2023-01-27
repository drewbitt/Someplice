<script lang="ts">
	import { page } from '$app/stores';
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import { Title, Button } from '@svelteuidev/core';
	import type { PageServerData } from './$types';
	import { trpc } from '$src/lib/trpc/client';

	export let data: PageServerData;
	let { goals } = data;
	type Goals = typeof goals[0];

	// DnD
	let dragDisabled = true;

	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		let items = event.detail.items;
		items = items.map((item, index) => {
			return { ...item, orderNumber: index };
		});
		await trpc($page).goals.updateGoals.mutate({ goals: items as Goals[] });
	};
</script>

<form>
	<Title class="flex" color="white">
		Goals
		<Button class="mx-2">Edit</Button>
		<Button class="mx-2" on:click={() => (dragDisabled = !dragDisabled)}
			>{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}</Button
		>
	</Title>
	<section
		class="overflow-scroll"
		use:dndzone={{ items: goals, dragDisabled }}
		on:consider={handleDndConsider}
		on:finalize={handleDndFinalize}
	>
		{#each goals as goal (goal.orderNumber)}
			<GoalBoxComponent {goal} />
		{/each}
	</section>
	<NewGoalBoxComponent />
</form>
