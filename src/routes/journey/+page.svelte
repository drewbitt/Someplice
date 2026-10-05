<script lang="ts">
	import JourneyDayBox from '#lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '#lib/components/today/GoalBadges.svelte';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '#lib/components/journey/EmptyDayBoxWrapper.svelte';
	import { trpc } from '#lib/trpc/client.js';
	import type { Goal, Outcome } from '#lib/trpc/types.js';
	import {
		mergeWindows,
		omitWindowDays,
		windowDates,
		type DayWindow
	} from '#lib/components/journey/windows.js';
	import { goalsForJourneyDay } from '#lib/utils/index.js';
	import { journeyPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { onMount, untrack } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';

	let { data }: { data: PageServerData } = $props();

	let extraWindow = $state<DayWindow>({
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
			const serverDates = new Set([
				...windowDates(serverWindow),
				...windowDates(extraWindow).filter((date) => date >= serverWindow.oldestLoadedDate)
			]);
			extraWindow = omitWindowDays(extraWindow, serverDates);
		});
	});

	let noGoals = $derived(data.goals.length === 0);
	// Outcome rows belong to the day set too: a reviewed day whose intentions
	// were later deleted must still render.
	let dates = $derived(
		[
			...new Set([
				...Object.keys(intentionsByDate),
				...outcomes.map((outcome) => outcome.date),
				...completedPriorities
					.map((priority) => priority.completedAt?.slice(0, 10))
					.filter((date): date is string => Boolean(date))
			])
		].sort((a, b) => b.localeCompare(a))
	);
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

	async function fetchWindow(windowStart: Date, windowEnd: Date): Promise<DayWindow> {
		const [windowIntentionsByDate, windowOutcomes, windowCompletedPriorities] = await Promise.all([
			trpc().intentions.listByDate.query({ startDate: windowStart, endDate: windowEnd }),
			trpc().outcomes.list.query({
				startDate: windowStart,
				endDate: windowEnd,
				order: 'desc',
				orderBy: 'date'
			}),
			trpc().priorities.listCompleted.query({ startDate: windowStart, endDate: windowEnd })
		]);

		const windowVerdicts = await trpc().outcomes.verdictsByOutcomeIds.query({
			outcomeIds: windowOutcomes.map((o) => o.id).filter((id): id is number => id !== null)
		});

		const outcomeDateById = new Map(
			windowOutcomes
				.filter((outcome): outcome is Outcome & { id: number } => outcome.id !== null)
				.map((outcome) => [outcome.id, outcome.date])
		);
		const windowDays = [
			...new Set([
				...Object.keys(windowIntentionsByDate),
				...windowOutcomes.map((outcome) => outcome.date),
				...windowCompletedPriorities
					.map((priority) => priority.completedAt?.slice(0, 10))
					.filter((date): date is string => Boolean(date))
			])
		];
		const windowGoalsByDate: Record<string, Goal[]> = {};
		await Promise.all(
			windowDays.map(async (date) => {
				const [activeGoals, inactiveGoals] = await Promise.all([
					trpc().goals.listGoalsOnDate.query({ date: new Date(date) }),
					trpc().goals.listGoalsOnDate.query({ active: 0, date: new Date(date) })
				]);
				windowGoalsByDate[date] = goalsForJourneyDay(
					activeGoals,
					inactiveGoals.map((goal) => ({ ...goal, active: 0 }) as Goal),
					windowIntentionsByDate[date] ?? [],
					[
						...windowVerdicts
							.filter((verdict) => outcomeDateById.get(verdict.outcomeId) === date)
							.map((verdict) => verdict.goalId),
						...windowCompletedPriorities
							.filter((priority) => priority.completedAt?.slice(0, 10) === date)
							.map((priority) => priority.goalId)
					]
				);
			})
		);

		return {
			intentionsByDate: windowIntentionsByDate,
			goalsByDate: windowGoalsByDate,
			outcomes: windowOutcomes,
			verdicts: windowVerdicts,
			completedPriorities: windowCompletedPriorities
		};
	}

	function mergeWindow(window: DayWindow) {
		extraWindow = mergeWindows(extraWindow, window);
	}

	// Pages are anchored on a date cursor rather than a row offset: offsets drift
	// when days are added, and a day's data spans several tables that must be
	// fetched over one shared window instead of paged independently.
	async function loadMore() {
		if (isLoadingMore || !hasMore || !oldestLoadedDate) return;
		isLoadingMore = true;
		try {
			const limit = 15;
			const endDate = new SvelteDate(`${oldestLoadedDate}T00:00:00.000Z`);
			endDate.setUTCDate(endDate.getUTCDate() - 1);
			const uniqueDates = (
				await trpc().intentions.listUniqueDates.query({
					startDate: new Date(0),
					endDate,
					limit
				})
			).map((d) => d.date);

			if (uniqueDates.length > 0) {
				// The window runs from the oldest anchor all the way up to the cursor,
				// so outcome/priority-only days between two pages aren't skipped.
				const windowStart = new Date(
					`${uniqueDates[uniqueDates.length - 1].slice(0, 10)}T00:00:00.000Z`
				);
				mergeWindow(await fetchWindow(windowStart, endDate));
				oldestLoadedDate = uniqueDates[uniqueDates.length - 1].slice(0, 10);
				return;
			}

			// No intention days remain below the cursor, but days that only have an
			// outcome or a completed priority may still exist further back.
			const [tailOutcomes, tailPriorities] = await Promise.all([
				trpc().outcomes.list.query({
					startDate: new Date(0),
					endDate,
					order: 'desc',
					orderBy: 'date',
					limit
				}),
				trpc().priorities.listCompleted.query({
					startDate: new Date(0),
					endDate,
					limit
				})
			]);
			const tailDays = [
				...new Set([
					...tailOutcomes.map((outcome) => outcome.date),
					...tailPriorities
						.map((priority) => priority.completedAt?.slice(0, 10))
						.filter((date): date is string => Boolean(date))
				])
			]
				.sort((a, b) => b.localeCompare(a))
				.slice(0, limit);

			if (tailDays.length === 0) {
				hasMore = false;
				return;
			}
			const windowStart = new Date(`${tailDays[tailDays.length - 1]}T00:00:00.000Z`);
			mergeWindow(await fetchWindow(windowStart, endDate));
			oldestLoadedDate = tailDays[tailDays.length - 1];
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
			const window = await fetchWindow(
				new Date(`${dateKey}T00:00:00.000Z`),
				new Date(`${dateKey}T23:59:59.999Z`)
			);

			window.intentionsByDate[dateKey] ??= [];
			window.goalsByDate[dateKey] ??= [];
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

{#if noGoals || noJourneyDays}
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
					priorities={data.priorities}
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
