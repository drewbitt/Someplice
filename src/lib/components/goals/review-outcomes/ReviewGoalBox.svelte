<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { createEventDispatcher } from 'svelte';
	import { evenEvenLighterHSLColor } from '$src/lib/utils';
	import Plus from 'virtual:icons/lucide/plus';
	import NewOutcomeTextBox from './NewOutcomeTextBox.svelte';

	export let goal: Goal;
	export let intentions: Intention[];
	const dispatch = createEventDispatcher();
	let newOutcomeTexts: string[] = [];

	const lighterGoalColor = (color: string) => {
		return evenEvenLighterHSLColor(color);
	};

	function showNewOutcomeTextBox() {
		newOutcomeTexts = [...newOutcomeTexts, ''];
	}

	function handleNewOutcomeTextChanged(event: CustomEvent<{ value: string; index: number }>) {
		newOutcomeTexts[event.detail.index] = event.detail.value;
		newOutcomeTexts = newOutcomeTexts.slice(); // create a new reference to trigger reactivity
		dispatch('updateNewOutcomeTexts', { goalId: goal.id, texts: newOutcomeTexts });
	}
</script>

<div
	role="listitem"
	id="goal-review-item"
	class="flex w-full max-w-screen-2xl flex-col items-center"
>
	<div class="goal-review-item-content flex w-4/5 min-w-min flex-col">
		<div id="goal-review-item-info">
			<span class="flex">
				<span
					style="background-color: {lighterGoalColor(goal.color)}; color: {goal.color}"
					class="px-1.5 font-mono text-2xl font-bold leading-none"
				>
					{goal.orderNumber}
				</span>
				<span
					style="background-color: {goal.color}; font-size: 1.1rem;"
					class="px-1.5 font-semibold leading-6 tracking-wider text-white"
				>
					{goal.title}
				</span>
			</span>
		</div>
		<div
			class="grid max-w-full gap-2.5 border-2 p-1.5 px-3 py-2.5"
			style="border-color: {goal.color}"
		>
			{#if goal.description}
				<p class="pl-5 font-mono text-lg tracking-wide text-gray-500">{goal.description}</p>
			{/if}
			{#if intentions.length && intentions[0].goalId === goal.id}
				{#each intentions as intention}
					<div class="flex">
						<input
							type="checkbox"
							id="intention-{intention.id}"
							value={intention.id}
							checked={Boolean(intention.completed)}
							class="daisy-checkbox-md mr-2"
						/>
						<label
							for="intention-{intention.id}"
							class="text-lg font-semibold leading-6"
							style="color: {goal.color}">{intention.text}</label
						>
					</div>
				{/each}
			{:else}
				<p class="text-gray-500">No intentions for this goal occurred</p>
			{/if}
			{#each newOutcomeTexts as text, index (index)}
				<NewOutcomeTextBox
					{goal}
					{index}
					newOutcomeText={text}
					on:textChanged={(e) => handleNewOutcomeTextChanged(e)}
				/>
			{/each}
			<button
				class="daisy-tooltip daisy-tooltip-right flex justify-self-start pb-1 pe-1 transition-colors duration-300"
				data-tip="Add another outcome not already listed"
				aria-label="Add another outcome not already listed"
				on:click={showNewOutcomeTextBox}
			>
				<Plus class="h-5 w-5 hover:bg-gray-500" />
			</button>
		</div>
	</div>
</div>
