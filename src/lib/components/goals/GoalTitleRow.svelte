<script lang="ts">
	import GoalColorPalette from './GoalColorPalette.svelte';
	import { readableTextColor } from '#lib/utils/index.js';

	let {
		goalColor = $bindable(),
		goalId,
		currentlyEditing,
		title = $bindable(),
		isInactiveGoal = false
	}: {
		goalColor: string;
		goalId: number | null;
		currentlyEditing: boolean;
		title: string;
		isInactiveGoal?: boolean;
	} = $props();
</script>

{#if currentlyEditing && !isInactiveGoal}
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="goal-box-title-editable min-w-0 flex-1 basis-48">
			<input
				bind:value={title}
				aria-label="Goal title"
				autocomplete="off"
				maxlength="120"
				class="goal-edit-input w-full rounded-md border-2 px-2 py-1 text-3xl"
			/>
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<span class="pr-1" style="color: {readableTextColor(goalColor)}">Color:</span>
			<GoalColorPalette bind:goalColor {goalId} />
		</div>
	</div>
{:else}
	<div class="goal-box-title w-full">
		<p
			class="text-2xl leading-tight break-words sm:text-3xl"
			style="color: {readableTextColor(goalColor)}"
			{title}
		>
			{title}
		</p>
	</div>
{/if}
