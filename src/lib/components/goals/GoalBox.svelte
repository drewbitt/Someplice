<script lang="ts">
	import type { PageServerData } from '.svelte-kit/types/src/routes/goals/$types';
	import { Box, Text, Title } from '@svelteuidev/core';

	export let goal: PageServerData['goals'][0];
</script>

<Box
	class="pb-1 my-2.5 mx-5 grid"
	css={{
		'grid-gap': '1rem',
		/* minimum width of 0 */
		'grid-template-columns': 'minmax(0, 3rem) 4fr',
		'grid-auto-rows': '6rem',
		'line-height': '1'
	}}
	className="goal-box"
>
	<Box root="span" class="font-mono text-7xl" className="goal-box-number">
		{goal.orderNumber}
	</Box>
	<Box className="goal-box-details">
		<Box>
			<Text class="text-3xl" color="white">{goal.title}</Text>
		</Box>
		<Box>
			<Text color="dimmed">{goal.description}</Text>
		</Box>
	</Box>
</Box>
