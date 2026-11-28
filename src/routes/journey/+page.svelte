<script lang="ts">
	import JourneyDayBox from '#lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '#lib/components/today/GoalBadges.svelte';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '#lib/components/journey/EmptyDayBoxWrapper.svelte';
	import { trpc } from '#lib/trpc/client.js';
	import {
		journeyDates,
		mergeWindows,
		omitWindowDays,
		windowDates,
		type JourneyWindow
	} from '#lib/components/journey/windows.js';
	import { journeyPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { onMount, untrack } from 'svelte';

	let { data }: { data: PageServerData } = $props();
	let activePriorities = $derived(data.priorities);

	let extraWindow = $state<JourneyWindow>({
		outcomes: [],
		verdicts: [],
		intentionsByDate: {},
		goalsByDate: {},
		completedPriorities: []
	});
	let journey = $derived(mergeWindows(data, extraWindow));
	let { outcomes, verdicts, intentionsByDate, goalsByDate, completedPriorities } =
		$derived(journey);

	$effect(() => {
		const serverWindow = data;
		untrack(() => {
			const serverDates = new Set(
				windowDates(extraWindow).filter((date) => date >= serverWindow.oldestLoadedDate)
			);
			extraWindow = omitWindowDays(extraWindow, serverDates);
		});
	});

	// Outcome rows belong to the day set too: a reviewed day whose intentions
	// were later deleted must still render.
	let dates = $derived(journeyDates(journey).sort((a, b) => b.localeCompare(a)));
	let noJourneyDays = $derived(dates.length === 0);

	let oldestLoadedDate = $state<string>();
	$effect(() => {
		oldestLoadedDate ??= data.oldestLoadedDate;
	});
	let hasMore = $state(true);
	let isLoadingMore = $state(false);
	let invisibleFooter = $state<HTMLDivElement>();

	onMount(() => {
		const handleIntersect = (entries: IntersectionObserverEntry[]) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && hasMore && !isLoadingMore) {
					loadMore();
				}
			});
		};

		const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
		if (invisibleFooter) {
			observer.observe(invisibleFooter);
		}
		return () => observer.disconnect();
	});

	function mergeWindow(window: JourneyWindow) {
		extraWindow = mergeWindows(extraWindow, window);
	}

	// Pages are anchored on a date cursor rather than a row offset: offsets drift
	// when days are added, and a day's data spans several tables that must be
	// fetched over one shared window instead of paged independently.
	async function loadMore() {
		if (isLoadingMore || !hasMore || !oldestLoadedDate) return;
		isLoadingMore = true;
		try {
			const page = await trpc().journey.page.query({ before: oldestLoadedDate });
			hasMore = page.hasMore;
			if (hasMore) {
				mergeWindow(page.window);
				oldestLoadedDate = page.oldestLoadedDate;
			}
		} catch (error) {
			journeyPageErrorStore.setError(
				error instanceof Error ? error.message : 'Failed to load more days'
			);
		} finally {
			isLoadingMore = false;
		}
	}

	async function refreshDay(dateKey: string) {
		try {
			const window = await trpc().journey.day.query(dateKey);

			window.intentionsByDate[dateKey] ??= [];
			mergeWindow(window);
		} catch (error) {
			journeyPageErrorStore.setError(
				error instanceof Error ? error.message : 'Failed to refresh the day'
			);
		}
	}
</script>

<svelte:head>
	<title>Someplice - Journey</title>
</svelte:head>

<div class="w-full pb-3 shadow-md">
	<div class="mx-4 grid gap-4 sm:mx-12">
		<h1 class="text-3xl font-bold text-balance">My daily progress</h1>
		<GoalBadges goals={data.goals} />
	</div>
</div>

{#if noJourneyDays}
	<div role="alert" class="alert alert-error border-error">
		<CircleX class="size-6 shrink-0 stroke-current" />
		<span>Begin your Journey by adding goals and intentions.</span>
	</div>
{:else}
	<section class="bg-base-200">
		<div class="mx-4 grid gap-4 py-6 sm:mx-12 xl:mx-36">
			{#each dates as date, i (date)}
				<JourneyDayBox
					goals={goalsByDate[date] ?? data.goals}
					{date}
					intentions={intentionsByDate[date] ?? []}
					{outcomes}
					{verdicts}
					priorities={activePriorities}
					onPrioritiesChanged={(priorities) => (activePriorities = priorities)}
					{completedPriorities}
					onDayChanged={() => refreshDay(date)}
				/>
				{#if i < dates.length - 1}
					<EmptyDayBoxWrapper {date} nextDate={dates[i + 1]} />
				{/if}
			{/each}
		</div>
		{#if isLoadingMore}
			<div class="mb-3 flex justify-center">
				<span class="loading loading-bars loading-lg motion-reduce:[animation-duration:2s]"></span>
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
