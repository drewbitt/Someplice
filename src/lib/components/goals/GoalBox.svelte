<script lang="ts">
	import type { Goals } from '$src/lib/types/data';
	import { Box, Text, Title } from '@svelteuidev/core';

	export let id: number;
	export let active: Goals['active'];
	export let orderNumber: Goals['orderNumber'];
	export let title: Goals['title'];
	export let description: Goals['description'];
	export let color: Goals['color'];
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
		{orderNumber}
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
