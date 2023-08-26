<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';
	import { Box, TextInput } from '@svelteuidev/core';
	import { createEventDispatcher } from 'svelte';

	export let goal: Goal;
	export let newOutcomeText: string;
	export let index: number;

	const dispatch = createEventDispatcher();

	function handleInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const updatedText = target.value;
		dispatch('textChanged', { value: updatedText, index });
	}
</script>

<Box class="flex">
	<span style="color: {goal.color}" class="me-1 text-xl leading-8">
		{goal.orderNumber})
	</span>
	<TextInput
		placeholder="What did you do?"
		value={newOutcomeText}
		on:input={handleInputChange}
		class="w-full sm:w-3/5"
	/>
</Box>
