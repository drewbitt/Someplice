<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { Box, Notification, Text } from '@svelteuidev/core';
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
	export let addedGoal: boolean;

	// Get default new goal title from number of active goals + 1
	const getGoalTitle = async () => {
		const allGoals = await trpc($page).goals.list.query(1);
		return `Goal ${allGoals.length + 1}`;
	};

	const addGoal = async () => {
		addedGoal = false;
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

		// Safety/order of an await as part of an object, inside an await?
		const addResult = await trpc().goals.add.mutate({
			title: await getGoalTitle(),
			color: randomColorValue,
			active: 1
		});
		if (addResult) {
			await invalidateAll();
			addedGoal = true;
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
