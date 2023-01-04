<script lang="ts">
	import GoalBoxComponent from '$src/lib/components/GoalBox.svelte';
	import type { GoalBox } from '$src/lib/types';
	import { Box, Button, Title } from '@svelteuidev/core';

	function edit() {
		console.log('edit');
	}
	function renumber() {
		console.log('renumber');
	}

	const testGoals: GoalBox[] = [
		{
			id: 1,
			name: 'Goal 1',
			description: 'This is a goal'
		},
		{
			id: 2,
			name: 'Goal 2',
			description: 'This is a goal'
		},
		{
			id: 3,
			name: 'Goal 3',
			description: 'This is a goal'
		}
	];
</script>

<form>
    <Title order={1} className="flex-1">
        Goals
		<Button class="mx-2">Edit</Button>
		<Button class="mx-2">Renumber Goals</Button>
	</Title>
	{#each testGoals as goal}
		<GoalBoxComponent {...goal} />
	{/each}
</form>
