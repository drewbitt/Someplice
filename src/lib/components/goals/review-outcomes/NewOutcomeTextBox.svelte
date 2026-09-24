<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';

	let {
		goal,
		newOutcomeText,
		index,
		onTextChanged
	}: {
		goal: Goal;
		newOutcomeText: string;
		index: number;
		onTextChanged: (detail: { value: string; index: number }) => void;
	} = $props();

	function handleInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		onTextChanged({ value: target.value, index });
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
		autocomplete="off"
		class="input w-full sm:w-3/5"
	/>
</div>
