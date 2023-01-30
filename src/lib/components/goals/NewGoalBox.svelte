<script lang="ts">
	import { Box, Text } from '@svelteuidev/core';
	import { TRPCClientError } from '@trpc/client';
	import { trpc } from '$src/lib/trpc/client';
	import { invalidateAll } from '$app/navigation';
	import daisyUiThemes from 'daisyui/src/colors/themes';

	const addGoal = async () => {
		// Get random color from daisyUI default themes
		try {
			let themes: { [key: string]: string }[] = Object.values(daisyUiThemes);
			// Filter for only dark themes
			themes = themes.filter((theme) => {
				return theme['color-scheme'] === 'dark';
			});
			const randomColorObject: Record<string, string> = themes[
				Math.floor(Math.random() * themes.length)
			] as unknown as Record<string, string>;
			const randomColorValue = randomColorObject['base-100'];

			await trpc().goals.add.mutate({
				title: 'Goal 1',
				description: 'This is a goal',
				color: randomColorValue,
				active: 1
			});
			await invalidateAll();
		} catch (err) {
			if (err instanceof TRPCClientError) {
				// errors = JSON.parse(err.message);
			} else {
				throw err;
			}
		}
	};
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
	<Box root="span" class="font-mono text-7xl" className="goal-box-number">#</Box>
	<Box className="goal-box-details">
		<Box root="button" on:click={addGoal}>
			<Text class="text-3xl" color="white">New Goal</Text>
		</Box>
	</Box>
</Box>
