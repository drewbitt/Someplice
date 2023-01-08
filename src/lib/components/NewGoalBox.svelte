<script lang="ts">
	import type { GoalBox } from '$lib/types';
	import { Box, Text, Title } from '@svelteuidev/core';
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
    className="goal-box-new"
>
	<Box root="span" class="font-mono" className="goal-box-number" css={{ 'font-size': '80px' }}>
		#
	</Box>
	<Box className="goal-box-details">
		<Box>
			<Title>New Goal</Title>
		</Box>
	</Box>
</Box>
