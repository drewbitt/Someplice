<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import theme from '$lib/stores/theme';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	let { goals, intentions, outcomes }: { goals: Goal[]; intentions: Intention[]; outcomes: Outcome[] } = $props();

	let date = intentions[intentions.length - 1]?.date;
</script>

<div
	role="listitem"
	aria-label="Journey Day Box"
	class="grid w-full flex-col gap-3 border border-gray-300 py-3 shadow-lg"
	class:bg-gray-950={$theme === 'dark'}
	class:bg-white={$theme !== 'dark'}
>
	<h3
		class="ml-5 text-xl font-bold"
		class:text-gray-700={$theme === 'dark'}
		class:text-gray-300={$theme !== 'dark'}
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
	</h3>
	<div class="grid grid-cols-2">
		<IntentionsListBox {goals} {intentions} />
		<OutcomesBox {goals} {intentions} {outcomes} />
	</div>
</div>
