<script lang="ts">
	import { createStyles, Group, Input, Text } from '@svelteuidev/core';
	import GoalColorPalette from './GoalColorPalette.svelte';

	export let goalColor: string;
	export let currentlyEditing: boolean;
	export let title: string;

	const darkModeStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'white !important'
			}
		}
	}));
	$: ({ getStyles } = darkModeStyles());
	// TODO: Change Input to TextInput (allowing for easy erroring) when you can set input classnames directly
	// Not currently possible in svelteui.
</script>

{#if currentlyEditing}
	<Group position="apart">
		<div class="goal-box-title-editable w-1/2">
			<Input
				bind:value={title}
				class="text-3xl bg-transparent border-opacity-20 px-0 max-w-lg {getStyles()}"
			/>
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<Text class="pr-1">Color:</Text>
			<GoalColorPalette bind:goalColor />
		</div>
	</Group>
{:else}
	<div class="goal-box-title w-1/2">
		<Text class="text-3xl {getStyles()}">{title}</Text>
	</div>
{/if}
