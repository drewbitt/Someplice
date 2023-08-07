<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { Box, Button, colorScheme, createStyles } from '@svelteuidev/core';
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

<Box
	class={cx(
		'items-center p-4 flex flex-col',
		darkMode ? 'shadow shadow-black' : 'shadow-xl',
		getStyles()
	)}
	id="review-goals-form"
>
	<section class={'items-center p-4 pb-6 2xl:pb-7 w-full'}>
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
			<div role="list" id="goal-outcome-list-container" class="grid gap-6 place-items-center">
				{#each goalsOnDate as goal}
					<ReviewGoalBox {goal} intentions={intentionsOnDate} />
				{/each}
			</div>
		{/if}
	</section>
	<!-- Mimic the styling of ReviewGoalBox so the Save button aligns properly -->
	<!-- TODO: fix conditional mr padding as ReviewGoalBox is doing something funky I'm just trying to mimic-->
	<Box class="flex flex-col items-center w-full max-w-screen-2xl mr-6 md:mr-6 2xl:mr-0">
		<Box class="flex justify-end w-4/5 gap-2 min-w-min max-w-full">
			<Button>Save Review</Button>
		</Box>
	</Box>
</Box>
