<script lang="ts">
	import { Text } from '@svelteuidev/core';

	export let currentlyEditing: boolean;
	export let description: string;
	// goalColor is HSL
</script>

{#if currentlyEditing}
	<div class="goal-box-description-editable w-full">
		<textarea
			class="bg-white text-black py-1 px-2 w-5/6 max-w-6xl rounded-md border border-transparent overflow-visible"
			placeholder="Describe your goal"
			bind:value={description}
		/>
	</div>
{:else}
	<div class="goal-box-description w-full">
		<Text>{description}</Text>
	</div>
{/if}
