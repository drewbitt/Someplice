<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { Box, colorScheme, createStyles } from '@svelteuidev/core';
	import ReviewGoalBox from '../../goals/review-outcomes/ReviewGoalBox.svelte';
	import { localeCurrentDate } from '$src/lib/utils';

	export let intentionsOnLatestDate: Intention[];

	let showPageLoadingSpinner = true;
	let daysAgo: number;
	let goalsOnDate: Goal[];
	let intentionsOnDate: Intention[];

	$: {
		const intentionDate = new Date(intentionsOnLatestDate[0].date);
		const currentDate = localeCurrentDate();
		const timeDiff = Math.abs(currentDate.getTime() - intentionDate.getTime());
		daysAgo = Math.ceil(timeDiff / (1000 * 3600 * 24));

		Promise.all([listGoalsOnDate(intentionDate), listIntentionsOnDate(intentionDate)]).then(
			([goalsResult, intentionsResult]) => {
				goalsOnDate = goalsResult;
				intentionsOnDate = intentionsResult;
				showPageLoadingSpinner = false; // turn off loading spinner when all promises are resolved
			}
		);
	}

	const listGoalsOnDate = async (date: Date) => {
		const goals = await trpc($page).goals.listGoalsOnDate.query({
			active: 1,
			date: date
		});
		return goals;
	};
	const listIntentionsOnDate = async (date: Date) => {
		const intentions = await trpc($page).intentions.list.query({
			startDate: date.toISOString().split('T')[0] + 'T00:00:00.000Z',
			endDate: date.toISOString().split('T')[0] + 'T23:59:59.999Z'
		});
		return intentions;
	};

	const useStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'white'
			}
		}
	}));
	$: darkMode = $colorScheme === 'dark';
	$: ({ cx, getStyles } = useStyles());
</script>

<Box class={cx('items-center p-4', getStyles())} id="review-goals-form">
	<section
		class={cx('items-center p-4', darkMode ? 'shadow shadow-black' : 'shadow-xl', getStyles())}
	>
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
			<div role="list" id="goal-outcome-list-container" class="max-w-screen-xl grid gap-6">
				{#each goalsOnDate as goal}
					<ReviewGoalBox {goal} intentions={intentionsOnDate} />
				{/each}
			</div>
		{/if}
	</section>
</Box>
