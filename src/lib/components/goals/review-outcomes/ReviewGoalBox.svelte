<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { evenEvenLighterHSLColor } from '$src/lib/utils';
	import { beforeNavigate } from '$app/navigation';
	import Plus from 'virtual:icons/lucide/plus';
	import NewOutcomeTextBox from './NewOutcomeTextBox.svelte';

	let {
		goal,
		intentions,
		showTitle,
		hasBeenSaved,
		onUpdateNewOutcomeTexts,
		onPlusNewOutcomeButtonPressed,
		onCheckboxClicked
	}: {
		goal: Goal;
		intentions: Intention[];
		showTitle: boolean;
		hasBeenSaved: boolean;
		onUpdateNewOutcomeTexts?: (detail: { goalId: number | null; texts: string[] }) => void;
		onPlusNewOutcomeButtonPressed?: (detail: { goalId: number | null }) => void;
		onCheckboxClicked?: (detail: { intentionId: number | null }) => void;
	} = $props();

	let newOutcomeTexts = $state<string[]>([]);

	$effect(() => {
		if (hasBeenSaved) {
			newOutcomeTexts = [];
		}
	});

	beforeNavigate((navigation) => {
		if (!newOutcomeTexts.some((text) => text.trim())) return;
		if (navigation.willUnload) {
			navigation.cancel();
		} else if (!confirm('Discard unsaved outcome text?')) {
			navigation.cancel();
		}
	});

	const lighterGoalColor = (color: string) => {
		return evenEvenLighterHSLColor(color);
	};

	function handlePlusNewOutcome() {
		newOutcomeTexts = [...newOutcomeTexts, ''];
		onPlusNewOutcomeButtonPressed?.({ goalId: goal.id });
	}

	function handleCheckboxClick(intentionId: number | null) {
		onCheckboxClicked?.({ intentionId });
	}

	function handleNewOutcomeTextChanged(detail: { value: string; index: number }) {
		newOutcomeTexts[detail.index] = detail.value;
		newOutcomeTexts = newOutcomeTexts.slice(); // create a new reference to trigger reactivity
		onUpdateNewOutcomeTexts?.({ goalId: goal.id, texts: newOutcomeTexts });
	}
</script>

<div
	role="listitem"
	aria-label="Review Goal Box"
	class="flex w-full max-w-screen-2xl flex-col items-center"
>
	<div class="goal-review-item-content flex w-4/5 min-w-min flex-col">
		{#if showTitle}
			<div id="goal-review-item-info">
				<span class="flex">
					<span
						style="background-color: {lighterGoalColor(goal.color)}; color: {goal.color}"
						class="px-1.5 font-mono text-2xl leading-none font-bold"
					>
						{goal.orderNumber}
					</span>
					<span
						style="background-color: {goal.color}; font-size: 1.1rem;"
						class="px-1.5 leading-6 font-semibold tracking-wider text-white"
					>
						{goal.title}
					</span>
				</span>
			</div>
		{/if}
		<div
			class="grid max-w-full gap-2.5 border-2 p-1.5 px-3 py-2.5"
			style="border-color: {goal.color}"
		>
			{#if goal.description}
				<p class="text-base-content/60 pl-5 font-mono text-lg tracking-wide">
					{goal.description}
				</p>
			{/if}
			{#if intentions.filter((intention) => intention.goalId === goal.id).length > 0}
				{#each intentions.filter((intention) => intention.goalId === goal.id) as intention (intention.id)}
					<div class="flex">
						<input
							type="checkbox"
							id="intention-{intention.id}"
							value={intention.id}
							checked={Boolean(intention.completed)}
							class="checkbox-md mr-2 flex-shrink-0"
							onclick={() => handleCheckboxClick(intention.id)}
						/>
						<label
							for="intention-{intention.id}"
							class="text-lg leading-6 font-semibold"
							style="color: {goal.color}">{intention.text}</label
						>
					</div>
				{/each}
			{:else}
				<p class="text-base-content/60">No intentions for this goal occurred</p>
			{/if}
			{#each newOutcomeTexts as text, index (index)}
				<NewOutcomeTextBox
					{goal}
					{index}
					newOutcomeText={text}
					onTextChanged={handleNewOutcomeTextChanged}
				/>
			{/each}
			<button
				class="tooltip tooltip-right flex justify-self-start pe-1 pb-1 transition-colors duration-300"
				data-tip="Add another outcome not already listed"
				aria-label="Add another outcome not already listed"
				onclick={handlePlusNewOutcome}
			>
				<Plus class="hover:bg-base-300 h-5 w-5" />
			</button>
		</div>
	</div>
</div>
