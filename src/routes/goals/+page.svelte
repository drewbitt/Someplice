<script lang="ts">
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { Title, Button } from '@svelteuidev/core';
	import type { PageData } from './$types';

	export let data: PageData;

	let errors: { message: string; path: string[] }[] | null = null;
</script>

<form>
	<Title class="flex" color="white">
		Goals
		<Button class="mx-2">Edit</Button>
		<Button class="mx-2">Renumber Goals</Button>
	</Title>
	{#each data.goals as goal}
		<GoalBoxComponent {...goal} />
	{/each}
	<NewGoalBoxComponent />
</form>
