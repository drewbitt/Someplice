<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { Box, Text } from '@svelteuidev/core';
	import { colors } from './colors';
	import { goalPageErrorStore } from '$src/lib/stores/errors';

	export let addedGoal: boolean;

	// Get default new goal title from number of active goals + 1
	const getGoalTitle = async () => {
		const allGoals = await trpc($page).goals.list.query(1);
		return `Goal ${allGoals.length + 1}`;
	};

	const addGoal = async () => {
		addedGoal = false;

		try {
			const allGoals = await trpc($page).goals.list.query(1);
			// get randomColor from colors.ts that is not in use
			const allColors = colors;

			const usedColors = allGoals.map((goal) => goal.color);
			const availableColors = allColors.filter((color) => !usedColors.includes(color));
			const randomColorIndex = Math.floor(Math.random() * availableColors.length);
			const randomColorValue = availableColors[randomColorIndex];
			const addResult = await trpc().goals.add.mutate({
				title: await getGoalTitle(),
				color: randomColorValue,
				active: 1,
				description: null
			});
			if (addResult) {
				await invalidateAll();
				addedGoal = true;
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				// set goalPageErrorStore for 6 seconds, then revert it back to null
				goalPageErrorStore.set(error.message), setTimeout(() => goalPageErrorStore.set(null), 6000);
			}
		}
	};
</script>

<div class="goal-box-new mx-5 my-2.5 grid">
	<Box root="span" class="font-mono text-7xl" className="goal-box-number">#</Box>
	<Box className="goal-box-details">
		<Box id="new-goal-button" root="button" on:click={addGoal}>
			<Text class="text-3xl">New Goal</Text>
		</Box>
	</Box>
</div>

<style>
	.goal-box-new {
		gap: 1rem;
		/* minimum width of 0 */
		grid-template-columns: minmax(0, 3rem) 4fr;
		grid-auto-rows: 6rem;
		line-height: 1;
	}
</style>
