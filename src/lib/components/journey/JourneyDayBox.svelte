<script lang="ts">
	import type { Goal, Intention, Outcome, PriorityWithGoal } from '$src/lib/trpc/types';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	let {
		goals,
		intentions,
		outcomes,
		priorities = [],
		completedPriorities = []
	}: {
		goals: Goal[];
		intentions: Intention[];
		outcomes: Outcome[];
		priorities?: PriorityWithGoal[];
		completedPriorities?: PriorityWithGoal[];
	} = $props();

	let date = $derived(intentions[intentions.length - 1]?.date);
	let milestones = $derived(
		completedPriorities.filter(
			(priority) => priority.completedAt && priority.completedAt.slice(0, 10) === date?.slice(0, 10)
		)
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
	{#each milestones as milestone (milestone.id)}
		<p class="ml-5 font-semibold" style="color: {milestone.goalColor}">
			★ {milestone.goalOrderNumber} completed top priority: {milestone.text}
		</p>
	{/each}
	<div class="grid md:grid-cols-2">
		<IntentionsListBox {goals} {intentions} />
		<OutcomesBox {goals} {intentions} {outcomes} {priorities} />
	</div>
</div>
