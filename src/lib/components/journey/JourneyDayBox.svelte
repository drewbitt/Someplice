<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import theme from '$lib/stores/theme';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	let {
		goals,
		intentions,
		outcomes
	}: { goals: Goal[]; intentions: Intention[]; outcomes: Outcome[] } = $props();

	let date = $derived(intentions[intentions.length - 1]?.date);
</script>

<div
	role="listitem"
	aria-label="Journey Day Box"
	class="grid w-full flex-col gap-3 border border-gray-300 py-3 shadow-lg"
	class:bg-gray-950={theme.current === 'dark'}
	class:bg-white={theme.current !== 'dark'}
>
	<h2
		class="ml-5 text-xl font-bold"
		class:text-gray-400={theme.current === 'dark'}
		class:text-gray-500={theme.current !== 'dark'}
	>
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
	<div class="grid grid-cols-2">
		<IntentionsListBox {goals} {intentions} />
		<OutcomesBox {goals} {intentions} {outcomes} />
	</div>
</div>
