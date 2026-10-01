<script lang="ts">
	import type { Goal, Intention, Outcome, OutcomeVerdict, Priority } from '#src/lib/trpc/types.js';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	let {
		goals,
		date: dateProp,
		intentions,
		outcomes,
		verdicts = [],
		priorities = [],
		completedPriorities = [],
		onDayChanged
	}: {
		goals: Goal[];
		date?: string;
		intentions: Intention[];
		outcomes: Outcome[];
		verdicts?: OutcomeVerdict[];
		priorities?: Priority[];
		completedPriorities?: Priority[];
		// Called after an in-box write (saveReview, not_today) so the page can
		// re-fetch days that live in client-side extras state.
		onDayChanged?: () => void | Promise<void>;
	} = $props();

	let date = $derived(dateProp ?? intentions[intentions.length - 1]?.date);
	// A reviewed day keeps its outcome even when every intention is deleted;
	// the day box must still render it.
	let outcomeForDay = $derived(outcomes.find((outcome) => outcome.date === date?.slice(0, 10)));
	let dateISO = $derived(date ? `${date.slice(0, 10)}T00:00:00.000Z` : undefined);
	let milestones = $derived(
		completedPriorities.flatMap((priority) => {
			const goal = goals.find((goal) => goal.id === priority.goalId);
			return priority.completedAt?.slice(0, 10) === date?.slice(0, 10) && goal
				? [{ priority, goal }]
				: [];
		})
	);
</script>

<div
	role="listitem"
	aria-label="Journey Day Box"
	class="border-base-300 bg-base-100 grid w-full gap-3 border py-3 shadow-lg"
>
	<h2 class="text-base-content/60 ml-5 text-xl font-bold tabular-nums">
		{(() => {
			const dateObj = new Date(date);
			const formatter = new Intl.DateTimeFormat('en-US', {
				weekday: 'long',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				timeZone: 'UTC'
			});
			return formatter.format(dateObj).replace(/\//g, '-');
		})()}
	</h2>
	{#each milestones as milestone (milestone.priority.id)}
		<p class="ml-5 font-semibold" style="color: {milestone.goal.color}">
			★ {milestone.goal.orderNumber} completed top priority: {milestone.priority.text}
		</p>
	{/each}
	{#if intentions.length || outcomeForDay}
		<div class="grid md:grid-cols-2">
			{#if intentions.length}
				<IntentionsListBox {goals} {intentions} />
			{/if}
			<OutcomesBox
				{goals}
				{intentions}
				{outcomes}
				{verdicts}
				{priorities}
				date={dateISO}
				{onDayChanged}
			/>
		</div>
	{/if}
</div>
