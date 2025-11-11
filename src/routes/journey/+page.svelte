<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { Loader, Notification, Title, colorScheme } from '@svelteuidev/core';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '$src/lib/components/journey/EmptyDayBoxWrapper.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export let data: PageServerData;

	// Reactive variables
	$: noIntentions = Object.keys(data.intentionsByDate).length === 0;
	$: noGoals = data.goals.length === 0;
	$: darkMode = $colorScheme === 'dark';
	$: dates = Object.keys(data.intentionsByDate);

	// Pagination parameters
	/* 	
	TODO: Due to invalidateAll(), the page will be de-paginated on changes in the JourneyDayBoxes.
	This is not ideal, but it would be complicated to re-run all client queries as well,
	so leaving as a quick implementation for now.
	*/
	let currentPage = 1;
	let hasMore = true;
	let isLoadingMore = false;
	let invisibleFooter: HTMLDivElement;

	// Initialize the IntersectionObserver for infinite scrolling
	onMount(() => {
		if (browser) {
			type HandleIntersect = (entries: IntersectionObserverEntry[]) => void;

			const handleIntersect: HandleIntersect = (entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && hasMore && !isLoadingMore) {
						loadMore();
					}
				});
			};

			const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
			observer.observe(invisibleFooter);
		}
	});

	/**
	 * Fetches and appends more outcomes and intentions from the server.
	 * If no new data is found, sets `hasMore` to false.
	 */
	async function loadMore() {
		isLoadingMore = true;
		const limit = 15;
		const offset = currentPage * limit;

		// Fetch new outcomes
		const newOutcomes = await trpc().outcomes.list.query({
			limit,
			offset,
			order: 'desc',
			orderBy: 'date'
		});

		// Fetch new intentions if there are new outcomes
		if (newOutcomes.length) {
			data.outcomes = [...data.outcomes, ...newOutcomes];
			const uniqueDatesResult = await trpc().intentions.listUniqueDates.query({
				limit,
				offset
			});
			const uniqueDates = uniqueDatesResult.map((d) => d.date);

			if (uniqueDates.length) {
				const [startDate, endDate] = [
					new Date(uniqueDates[uniqueDates.length - 1]),
					new Date(uniqueDates[0])
				];
				const newIntentionsByDate = await trpc().intentions.listByDate.query({
					startDate,
					endDate
				});

				// Merge the new intentions with existing ones
				for (let date in newIntentionsByDate) {
					data.intentionsByDate[date] = data.intentionsByDate[date]
						? [...data.intentionsByDate[date], ...newIntentionsByDate[date]]
						: newIntentionsByDate[date];
				}

				currentPage += 1;
			} else {
				hasMore = false;
			}
		} else {
			hasMore = false;
		}

		isLoadingMore = false;
	}
</script>

<svelte:head>
	<title>Someplice - Journey</title>
</svelte:head>

<div class="w-full pb-3 shadow-md">
	<div class="mx-12 grid gap-4">
		<Title order={1} class="font-bold">My daily progress</Title>
		<GoalBadges goals={data.goals} />
	</div>
</div>

{#if noGoals || noIntentions}
	<Notification
		id="no-goals-notification"
		icon={CircleX}
		color="red"
		withCloseButton={false}
		class="border-gray-400"
	>
		Begin your Journey by adding goals and intentions.
	</Notification>
{:else}
	<section class={darkMode ? 'bg-gray-900' : 'bg-gray-200'}>
		<div class="mx-12 grid gap-4 py-6 xl:mx-36">
			{#each dates as date, i (date)}
				<JourneyDayBox
					goals={data.goals}
					intentions={data.intentionsByDate[date]}
					outcomes={data.outcomes}
				/>
				{#if i < dates.length - 1}
					<EmptyDayBoxWrapper {date} nextDate={dates[i + 1]} />
				{/if}
			{/each}
		</div>
		{#if isLoadingMore}
			<div class="mb-3 flex justify-center">
				<Loader variant="bars" />
			</div>
		{/if}
		<div bind:this={invisibleFooter} class="pagination-trigger"></div>
	</section>
{/if}

<style>
	.pagination-trigger {
		height: 4px;
		opacity: 0;
		pointer-events: none;
	}
</style>
