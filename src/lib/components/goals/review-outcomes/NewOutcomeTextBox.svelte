<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';
	import { createEventDispatcher } from 'svelte';

	let { goal, newOutcomeText, index }: { goal: Goal; newOutcomeText: string; index: number } = $props();

	const dispatch = createEventDispatcher();

	function handleInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const updatedText = target.value;
		dispatch('textChanged', { value: updatedText, index });
	}
</script>

<div class="flex">
	<span style="color: {goal.color}" class="me-1 text-xl leading-8">
		{goal.orderNumber})
	</span>
	<input
		placeholder="What did you do?"
		value={newOutcomeText}
		oninput={handleInputChange}
		class="input input-bordered w-full sm:w-3/5"
	/>
</div>
