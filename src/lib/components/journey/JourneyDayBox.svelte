<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import { Title, colorScheme, createStyles } from '@svelteuidev/core';
	import IntentionsListBox from './IntentionsListBox.svelte';
	import OutcomesBox from './OutcomesBox.svelte';

	export let goals: Goal[];
	export let intentions: Intention[];
	export let outcomes: Outcome[];

	let date = intentions[intentions.length - 1]?.date;

	const useStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'black'
			}
		}
	}));
	$: darkMode = $colorScheme === 'dark';
	$: ({ cx, getStyles } = useStyles());
</script>

<div
	role="listitem"
	aria-label="Journey Day Box"
	class={cx(
		'grid w-full flex-col gap-3 border border-gray-300 py-3 shadow-lg',
		darkMode ? 'bg-gray-950' : 'bg-white',
		getStyles()
	)}
>
	<Title order={3} class={cx('ml-5 font-bold', darkMode ? 'text-gray-700' : 'text-gray-300')}>
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
	</Title>
	<div class="grid grid-cols-2">
		<IntentionsListBox {goals} {intentions} />
		<!-- TODO: On mobile, OutcomesBox is too wide. -->
		<!-- Need to implement a different type of display -->
		<OutcomesBox {goals} {intentions} {outcomes} />
	</div>
</div>
