<script lang="ts">
	import type { PageServerData } from './$types';
	import { Box, Stack, Text, Title } from '@svelteuidev/core';
	import GoalTitleRow from './GoalTitleRow.svelte';

	export let goal: PageServerData['goals'][0];

	export let currentlyEditing: boolean;
	// TODO: make a palette of colors
</script>

<!-- Because of the equal size grid, the grid will break css with orderNumber >=10 -->
<Box
	class="my-2.5 mx-5 grid"
	css={{
		'grid-gap': '1rem',
		/* minimum width of 0 */
		'grid-template-columns': 'minmax(0, 3rem) 4fr',
		'grid-auto-rows': '6rem',
		'line-height': '1',
		'background-color': goal.color
	}}
	className="goal-box"
>
	<Box
		root="span"
		class="font-mono text-7xl"
		className="goal-box-number"
		css={{
			color: goal.color
		}}
	>
		{goal.orderNumber + 1}
	</Box>
	<Stack className="goal-box-details" spacing="xs">
		<GoalTitleRow title={goal.title} {currentlyEditing} />
		<Box>
			<Text color="dimmed">{goal.description}</Text>
		</Box>
	</Stack>
</Box>
