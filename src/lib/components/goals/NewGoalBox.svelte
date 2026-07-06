<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import { colors } from './colors';
	import { goalPageErrorStore } from '$src/lib/stores/errors';

	let { addedGoal = $bindable(), goalCount = 0 }: { addedGoal: boolean; goalCount?: number } = $props();

	const addGoal = async () => {
		addedGoal = false;

		try {
			const allGoals = await trpc().goals.list.query(1);
			const usedColors = allGoals.map((goal) => goal.color);
			const availableColors = colors.filter((color) => !usedColors.includes(color));
			const randomColorValue = availableColors[Math.floor(Math.random() * availableColors.length)];
			const addResult = await trpc().goals.add.mutate({
				title: `Goal ${allGoals.length + 1}`,
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

<div
	class="mx-5 my-2.5 grid leading-none"
	style="gap: 1rem; grid-template-columns: minmax(0, 3rem) 4fr; grid-auto-rows: 6rem;"
>
	<span class="font-mono text-7xl">#</span>
	<div>
		<button id="new-goal-button" onclick={addGoal}>
			<p class="text-3xl">New Goal</p>
		</button>
	</div>
</div>
