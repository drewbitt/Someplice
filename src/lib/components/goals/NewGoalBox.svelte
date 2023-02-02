<script lang="ts">
	import { page } from '$app/stores';
	import { Box, Notification, Text } from '@svelteuidev/core';
	import { trpc } from '$src/lib/trpc/client';
	import { invalidateAll } from '$app/navigation';
	import { colors } from './colors';

	let notificationVisible = false;
	// only let notificationVisible show for 5 seconds
	$: {
		if (notificationVisible) {
			setTimeout(() => {
				notificationVisible = false;
			}, 5000);
		}
	}

	const addGoal = async () => {
		notificationVisible = false;

		const allGoals = await trpc($page).goals.list.query(1);
		if (allGoals.length >= 9) {
			// Do not allow more than 9 goals due to layout limitations, color palette limitations
			notificationVisible = true;
			return;
		}
		// get randomColor from colors.ts that is not in use
		const allColors = colors;

		const usedColors = allGoals.map((goal) => goal.color);
		const availableColors = allColors.filter((color) => !usedColors.includes(color));
		const randomColorIndex = Math.floor(Math.random() * availableColors.length);
		const randomColorValue = availableColors[randomColorIndex];

		const addResult = await trpc().goals.add.mutate({
			title: 'Goal 1',
			color: randomColorValue,
			active: 1
		});
		if (addResult) {
			await invalidateAll();
		}
	};
</script>

{#if notificationVisible}
	<Notification
		closeButtonProps={{ 'aria-label': 'Hide notification' }}
		on:close={() => {
			notificationVisible = false;
		}}
	>
		You have reached the maximum number of 9 goals. Please delete a goal to add a new one.
	</Notification>
{/if}
<div class="goal-box-new my-2.5 mx-5 grid">
	<Box root="span" class="font-mono text-7xl" className="goal-box-number">#</Box>
	<Box className="goal-box-details">
		<Box root="button" on:click={addGoal}>
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
