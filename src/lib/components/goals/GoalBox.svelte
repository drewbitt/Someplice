<script lang="ts">
	import type { GoalBox } from '$lib/types';
	import { Box, Text, Title } from '@svelteuidev/core';

	export let id: GoalBox['id'];
	export let title: GoalBox['title'];
	export let description: GoalBox['description'];
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
		{id}
	</Box>
	<Box className="goal-box-details">
		<Box>
			<Text class="text-3xl" color="white">{title}</Text>
		</Box>
		<Box>
			<Text color="dimmed">{description}</Text>
		</Box>
	</Box>
</Box>
