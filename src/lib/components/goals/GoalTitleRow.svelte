<script lang="ts">
	import { Box, createStyles, Group, Input, Text } from '@svelteuidev/core';
	import GoalColorPalette from './GoalColorPalette.svelte';

	export let goalColor: string;
	export let currentlyEditing: boolean;
	export let title: string;
	export let isInactiveGoal = false;

	const useStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'white !important'
			}
		}
	}));
	$: ({ cx, getStyles } = useStyles());
	// TODO: Change Input to TextInput (allowing for easy erroring) when you can set input classnames directly
	// Not currently possible in svelteui.
</script>

{#if currentlyEditing && !isInactiveGoal}
	<Group position="apart">
		<div class="goal-box-title-editable w-1/2">
			<Input
				bind:value={title}
				class={cx('border-opacity-20 max-w-lg bg-transparent px-0 text-3xl', getStyles())}
			/>
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<Text class="pr-1">Color:</Text>
			<GoalColorPalette bind:goalColor />
		</div>
	</Group>
{:else}
	<Box class="goal-box-title w-1/2">
		<Text class="text-3xl {getStyles()}">{title}</Text>
	</Box>
{/if}
