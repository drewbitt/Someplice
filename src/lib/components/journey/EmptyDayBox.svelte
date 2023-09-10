<script lang="ts">
	import { Title, colorScheme, createStyles } from '@svelteuidev/core';

	export let numDays: number;

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
	id="journey-item-empty"
	class={cx(
		'grid w-full flex-col justify-center gap-3 border border-gray-300 py-4 shadow-lg',
		darkMode ? 'bg-gray-950' : 'bg-white',
		getStyles()
	)}
>
	<Title order={4} class={cx('ml-5 font-bold', darkMode ? 'text-gray-500' : 'text-gray-400')}>
		{numDays} blank days
	</Title>
</div>
