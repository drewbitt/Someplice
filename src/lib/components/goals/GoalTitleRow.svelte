<script lang="ts">
	import GoalColorPalette from './GoalColorPalette.svelte';

	export let goalColor: string;
	export let currentlyEditing: boolean;
	export let title: string;
	export let isInactiveGoal = false;
</script>

{#if currentlyEditing && !isInactiveGoal}
	<div class="flex items-center justify-between">
		<div class="goal-box-title-editable w-1/2">
			<input
				bind:value={title}
				class=" input  input-bordered border-opacity-20 w-full max-w-lg bg-transparent px-0 text-3xl dark:text-white"
			/>
		</div>
		<div id="goal-box-title-color-picker" class="flex items-center">
			<span class="text-base-content/80 pr-1">Color:</span>
			<GoalColorPalette bind:goalColor />
		</div>
	</div>
{:else}
	<div class="goal-box-title w-1/2">
		<p class="text-3xl dark:text-white">{title}</p>
	</div>
{/if}
