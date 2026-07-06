<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import theme from '$lib/stores/theme';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '$src/lib/components/journey/EmptyDayBoxWrapper.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { data }: { data: PageServerData } = $props();

	let noIntentions = $derived(Object.keys(data.intentionsByDate).length === 0);
	let noGoals = $derived(data.goals.length === 0);
	let darkMode = $derived($theme === 'dark');
	let dates = $derived(Object.keys(data.intentionsByDate));

	let currentPage = $state(1);
	let hasMore = $state(true);
	let isLoadingMore = $state(false);
	let invisibleFooter = $state<HTMLDivElement>();

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

	async function loadMore() {
		isLoadingMore = true;
		const limit = 15;
		const offset = currentPage * limit;

		const newOutcomes = await trpc().outcomes.list.query({
			limit,
			offset,
			order: 'desc',
			orderBy: 'date'
		});

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
		<h1 class="text-3xl font-bold">My daily progress</h1>
		<GoalBadges goals={data.goals} />
	</div>
</div>

{#if noGoals || noIntentions}
	<div role="alert" class="alert alert-error border-gray-400">
		<CircleX class="h-6 w-6 shrink-0 stroke-current" />
		<span>Begin your Journey by adding goals and intentions.</span>
	</div>
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
				<span class="loading loading-bars loading-lg" />
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
