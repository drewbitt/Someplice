<script lang="ts">
	import GoalColorPalette from './GoalColorPalette.svelte';
	import { readableTextColor } from '#lib/utils/index.js';

	let {
		goalColor = $bindable(),
		currentlyEditing,
		title = $bindable(),
		isInactiveGoal = false
	}: {
		goalColor: string;
		currentlyEditing: boolean;
		title: string;
		isInactiveGoal?: boolean;
	} = $props();
</script>

{#if currentlyEditing && !isInactiveGoal}
	<div class="flex items-center justify-between">
		<div class="goal-box-title-editable w-1/2">
			<input
				bind:value={title}
				autocomplete="off"
				class="input w-full max-w-lg bg-transparent px-0 text-3xl"
				style="color: {readableTextColor(goalColor)}"
			/>
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<span class="pr-1" style="color: {readableTextColor(goalColor)}">Color:</span>
			<GoalColorPalette bind:goalColor />
		</div>
	</div>
{:else}
	<div class="goal-box-title w-1/2">
		<p class="text-3xl" style="color: {readableTextColor(goalColor)}">{title}</p>
	</div>
{/if}
