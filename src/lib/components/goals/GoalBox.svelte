<script lang="ts">
	import type { PageServerData } from '../../../routes/goals/$types';
	import { Box, createStyles, Stack } from '@svelteuidev/core';
	import GoalTitleRow from './GoalTitleRow.svelte';
	import GoalDescription from './GoalDescription.svelte';
	import { cssvariable } from '@svelteuidev/composables';

	export let goal: PageServerData['goals'][0];
	export let currentlyEditing: boolean;

	let goalColor = goal.color;
	$: goal.color = goalColor;

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
		<GoalDescription bind:description={goal.description} {currentlyEditing} />
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
