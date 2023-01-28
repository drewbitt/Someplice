<script lang="ts">
	import { page } from '$app/stores';
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import { Title, Button } from '@svelteuidev/core';
	import type { PageServerData } from './$types';
	import { trpc } from '$src/lib/trpc/client';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

	export let data: PageServerData;
	type Goals = (typeof data.goals)[0];

	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}

	// DnD
	let dragDisabled = true;

	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index };
		});
		await trpc($page).goals.updateGoals.mutate({ goals: items });
	};
</script>

<div>
	<Title class="flex" color="white">
		Goals
		<Button class="mx-2">Edit</Button>
		<div class="indicator">
			<span class={dragDisabled ? '' : 'indicator-item badge badge-secondary translate-x-1/4'} />
			<Button class="mx-2" on:click={handleRenumberButtonClick}>
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
