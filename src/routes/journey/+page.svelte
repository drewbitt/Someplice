<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '$src/lib/components/journey/EmptyDayBoxWrapper.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention, Outcome, OutcomeVerdict, Priority } from '$src/lib/trpc/types';
	import { goalsForJourneyDay } from '$src/lib/utils';
	import { journeyPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { onMount } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';

	let { data }: { data: PageServerData } = $props();

	// Older pages live in their own state, merged with `data` below. Mutating the
	// `data` props directly never invalidated the derived day list (page-2+
	// fetched but never rendered) and got clobbered by invalidateAll anyway.
	let extraOutcomes = $state<Outcome[]>([]);
	let extraVerdicts = $state<OutcomeVerdict[]>([]);
	let extraIntentionsByDate = $state<Record<string, Intention[]>>({});
	let extraGoalsByDate = $state<Record<string, Goal[]>>({});
	let extraCompletedPriorities = $state<Priority[]>([]);

	let outcomes = $derived([...data.outcomes, ...extraOutcomes]);
	let verdicts = $derived([...data.verdicts, ...extraVerdicts]);
	let intentionsByDate = $derived({ ...extraIntentionsByDate, ...data.intentionsByDate });
	let goalsByDate = $derived({ ...extraGoalsByDate, ...data.goalsByDate });
	let completedPriorities = $derived([...data.completedPriorities, ...extraCompletedPriorities]);

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

			if (uniqueDates.length === 0) {
				hasMore = false;
				return;
			}

			const windowStart = new Date(uniqueDates[uniqueDates.length - 1]);
			const windowEnd = new Date(uniqueDates[0]);
			const [newIntentionsByDate, newOutcomes, newCompletedPriorities] = await Promise.all([
				trpc().intentions.listByDate.query({ startDate: windowStart, endDate: windowEnd }),
				trpc().outcomes.list.query({
					startDate: windowStart,
					endDate: windowEnd,
					order: 'desc',
					orderBy: 'date'
				}),
				trpc().priorities.listCompleted.query({ startDate: windowStart, endDate: windowEnd })
			]);

			extraOutcomes = [...extraOutcomes, ...newOutcomes];
			const newVerdicts = await trpc().outcomes.verdictsByOutcomeIds.query({
				outcomeIds: newOutcomes.map((o) => o.id).filter((id): id is number => id !== null)
			});
			extraVerdicts = [...extraVerdicts, ...newVerdicts];

			const knownPriorities = new Set(completedPriorities.map((priority) => priority.id));
			extraCompletedPriorities = [
				...extraCompletedPriorities,
				...newCompletedPriorities.filter((priority) => !knownPriorities.has(priority.id))
			];

			for (const date in newIntentionsByDate) {
				extraIntentionsByDate[date] = extraIntentionsByDate[date]
					? [...extraIntentionsByDate[date], ...newIntentionsByDate[date]]
					: newIntentionsByDate[date];
			}

			const outcomeDateById = new Map(
				outcomes
					.filter((outcome): outcome is typeof outcome & { id: number } => outcome.id !== null)
					.map((outcome) => [outcome.id, outcome.date])
			);
			const newDates = [
				...new Set([
					...Object.keys(newIntentionsByDate),
					...newOutcomes.map((outcome) => outcome.date),
					...newCompletedPriorities
						.map((priority) => priority.completedAt?.slice(0, 10))
						.filter((date): date is string => Boolean(date))
				])
			];
			await Promise.all(
				newDates.map(async (date) => {
					const [activeGoals, inactiveGoals] = await Promise.all([
						trpc().goals.listGoalsOnDate.query({ date: new Date(date) }),
						trpc().goals.listGoalsOnDate.query({ active: 0, date: new Date(date) })
					]);
					extraGoalsByDate[date] = goalsForJourneyDay(
						activeGoals,
						inactiveGoals.map((goal) => ({ ...goal, active: 0 }) as Goal),
						newIntentionsByDate[date] ?? [],
						[
							...verdicts
								.filter((verdict) => outcomeDateById.get(verdict.outcomeId) === date)
								.map((verdict) => verdict.goalId),
							...newCompletedPriorities
								.filter((priority) => priority.completedAt?.slice(0, 10) === date)
								.map((priority) => priority.goalId)
						]
					);
				})
			);

			oldestLoadedDate = uniqueDates[uniqueDates.length - 1];
		} catch (error) {
			journeyPageErrorStore.setError(
				error instanceof Error ? error.message : 'Failed to load more days'
			);
		} finally {
			isLoadingMore = false;
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
