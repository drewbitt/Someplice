<script lang="ts">
	import { Group, Input, Text } from '@svelteuidev/core';
	import GoalColorPalette from './GoalColorPalette.svelte';

	export let goalColor: string;
	export let currentlyEditing: boolean;
	export let title: string;
</script>

{#if currentlyEditing}
	<Group position="apart">
		<div class="goal-box-title-editable w-1/2">
			<Input bind:value={title} class="text-3xl bg-transparent border-opacity-10 px-0 max-w-lg" />
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<Text color="white" class="pr-1">Color:</Text>
			<GoalColorPalette bind:goalColor />
		</div>
	</Group>
{:else}
	<div class="goal-box-title w-1/2">
		<Text class="text-3xl" color="white">{title}</Text>
	</div>
{/if}
