<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { cssvariable } from '@svelteuidev/composables';
	import { Box, createStyles, Stack } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/goals/$types';
	import GoalDescription from './GoalDescription.svelte';
	import GoalTitleRow from './GoalTitleRow.svelte';

	export let goal: PageServerData['goals'][0];
	export let currentlyEditing: boolean;

	let goalColor = goal.color;
	$: goal.color = goalColor;

	// call trpc delete function
	const handleDeleteGoal = async () => {
		if (goal.id) {
			const deleteResult = await trpc($page).goals.delete.mutate(goal.id);
			if (deleteResult.length > 0) {
				await invalidateAll();
			}
		}
	};

	const darkModeStyles = createStyles((theme) => ({
		root: {
			darkMode: {
				color: 'white'
			}
		}
	}));
	$: ({ getStyles } = darkModeStyles());
</script>

<div
	style="background-color: {goalColor}"
	use:cssvariable={{ 'goal-color': goalColor }}
	class="goal-box my-2.5 mx-5 grid"
>
	<Box root="span" class="font-mono text-7xl {getStyles()}" className="goal-box-number">
		{goal.orderNumber}
	</Box>
	<Stack className="goal-box-details" spacing="xs">
		<GoalTitleRow bind:title={goal.title} {currentlyEditing} bind:goalColor />
		<GoalDescription bind:description={goal.description} {currentlyEditing} {handleDeleteGoal} />
	</Stack>
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
