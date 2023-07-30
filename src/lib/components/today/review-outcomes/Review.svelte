<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { Box, createStyles } from '@svelteuidev/core';
	import ReviewGoalBox from '../../goals/review-outcomes/ReviewGoalBox.svelte';

	export let intentionsOnLatestDate: Intention[];

	let showPageLoadingSpinner = true;
	let daysAgo: number;
	let goalsOnDate: Goal[];

	$: {
		listGoalsOnDate(new Date(intentionsOnLatestDate[0].date)).then((result) => {
			goalsOnDate = result;
			showPageLoadingSpinner = false;
		});

		const currentDate = new Date();
		const intentionDate = new Date(intentionsOnLatestDate[0].date);
		const timeDiff = Math.abs(currentDate.getTime() - intentionDate.getTime());
		daysAgo = Math.ceil(timeDiff / (1000 * 3600 * 24));
	}

	const listGoalsOnDate = async (date: Date) => {
		const goals = await trpc($page).goals.listGoalsOnDate.query({
			active: 1,
			date: date
		});
		return goals;
	};

	const darkModeStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'black'
			}
		}
	}));
	$: ({ getStyles } = darkModeStyles());
</script>

<Box class="items-center p-4 {getStyles()}">
	<section class="flex flex-col rounded-lg bg-white p-4 shadow-lg">
		<h1 class="mb-5 text-center text-2xl">
			Finish reviewing {new Date(intentionsOnLatestDate[0].date).toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric'
			})}
		</h1>
		<p class="mb-5 text-center text-lg">
			Reflect on what you did towards your goals {daysAgo} days ago:
		</p>
		{#if showPageLoadingSpinner}
			<div class="flex justify-center">
				<span class="daisy-loading daisy-loading-spinner daisy-loading-lg" />
			</div>
		{:else}
			<div
				role="list"
				id="goal-outcome-list-container"
				class="flex w-4/5 max-w-screen-xl flex-col self-center"
			>
				{#each goalsOnDate as goal}
					<ReviewGoalBox {goal} />
				{/each}
			</div>
		{/if}
	</section>
</Box>
