<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import { colors } from './colors';
	import { goalPageErrorStore } from '$src/lib/stores/errors';

	export let addedGoal: boolean;

	const getGoalTitle = async () => {
		const allGoals = await trpc().goals.list.query(1);
		return `Goal ${allGoals.length + 1}`;
	};

	const addGoal = async () => {
		addedGoal = false;

		try {
			const allGoals = await trpc().goals.list.query(1);
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
				goalPageErrorStore.setError(error.message);
			}
		}
	};
</script>

<div class="goal-box-new mx-5 my-2.5 grid">
	<span class="font-mono text-7xl">#</span>
	<div class="goal-box-details">
		<button id="new-goal-button" on:click={addGoal}>
			<p class="text-3xl">New Goal</p>
		</button>
	</div>
</div>

<style>
	.goal-box-new {
		gap: 1rem;
		grid-template-columns: minmax(0, 3rem) 4fr;
		grid-auto-rows: 6rem;
		line-height: 1;
	}
</style>
