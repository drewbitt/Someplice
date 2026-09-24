<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import type { OutcomeVerdicts } from '$src/lib/types/data';
	import type { Selectable } from 'kysely';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	let {
		goals,
		intentions,
		outcomes,
		verdicts = []
	}: {
		goals: Goal[];
		intentions: Intention[];
		outcomes: Outcome[];
		verdicts?: Selectable<OutcomeVerdicts>[];
	} = $props();

	let date = $derived(intentions[intentions.length - 1]?.date);
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
	<div class="grid md:grid-cols-2">
		<IntentionsListBox {goals} {intentions} />
		<OutcomesBox {goals} {intentions} {outcomes} {verdicts} />
	</div>
</div>
