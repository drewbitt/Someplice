<script lang="ts">
	import { Text } from '@svelteuidev/core';

	export let currentlyEditing: boolean;
	export let description: string;
	// goalColor is HSL
	export let goalColor: string;
	let calculatedColor = () => {
		if (goalColor) {
			const [h, s, l] = goalColor.split(',').map((x) => parseInt(x));
			if (l < 40) {
				return 'dimmed';
			} else {
				return 'black';
			}
		} else {
			return 'dimmed';
		}
	};
</script>

{#if currentlyEditing}
	<div class="goal-box-description-editable w-full">
		<textarea
			class="bg-white py-1 px-2 w-5/6 max-w-6xl rounded-md border border-transparent overflow-visible"
			placeholder="Describe your goal"
			bind:value={description}
		/>
	</div>
{:else}
	<div class="goal-box-description w-full">
		<Text color={calculatedColor()}>{description}</Text>
	</div>
{/if}
