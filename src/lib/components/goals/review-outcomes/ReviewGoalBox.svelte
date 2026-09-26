<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';
	import { evenEvenLighterHSLColor, type IntentionRow } from '$src/lib/utils';
	import CalendarX from 'virtual:icons/lucide/calendar-x';
	import Plus from 'virtual:icons/lucide/plus';
	import Undo2 from 'virtual:icons/lucide/undo-2';
	import NewOutcomeTextBox from './NewOutcomeTextBox.svelte';

	let {
		goal,
		intentions,
		showTitle,
		hasBeenSaved,
		onUpdateNewOutcomeTexts,
		onPlusNewOutcomeButtonPressed,
		onCheckboxClicked,
		onNotTodayToggled
	}: {
		goal: Goal;
		intentions: IntentionRow[];
		showTitle: boolean;
		hasBeenSaved: boolean;
		onUpdateNewOutcomeTexts?: (detail: { goalId: number | null; texts: string[] }) => void;
		onPlusNewOutcomeButtonPressed?: (detail: { goalId: number | null }) => void;
		onCheckboxClicked?: (detail: { intentionId: number | null }) => void;
		onNotTodayToggled?: (detail: { intention: IntentionRow }) => void;
	} = $props();

	let newOutcomeTexts = $state<string[]>([]);

	$effect(() => {
		if (hasBeenSaved) {
			newOutcomeTexts = [];
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
						style="background-color: {goal.color}"
						class="px-1.5 text-[1.1rem] leading-6 font-semibold tracking-wider text-white"
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
					<div class="flex items-center">
						<input
							type="checkbox"
							id="intention-{intention.id}"
							value={intention.id}
							checked={intention.status === 'done'}
							class="checkbox-md mr-2 shrink-0"
							onclick={() => handleCheckboxClick(intention.id)}
						/>
						<label
							for="intention-{intention.id}"
							class="goal-text text-lg leading-6 font-semibold {intention.status === 'not_today'
								? 'italic opacity-60'
								: ''}"
							style="--goal-color: {goal.color}"
							>{#if intention.status === 'not_today'}-{goal.orderNumber}{intention.subIntentionQualifier ??
									''})
							{/if}{intention.text}</label
						>
						{#if onNotTodayToggled}
							<button
								class="md:tooltip md:tooltip-right ml-1 flex opacity-40 transition-opacity hover:opacity-100"
								data-tip={intention.status === 'not_today' ? 'Mark pending' : 'Not today'}
								aria-label={intention.status === 'not_today'
									? `Mark ${intention.text} as pending`
									: `Mark ${intention.text} as not today`}
								onclick={() => onNotTodayToggled({ intention })}
							>
								{#if intention.status === 'not_today'}
									<Undo2 class="hover:bg-base-300 size-4" />
								{:else}
									<CalendarX class="hover:bg-base-300 size-4" />
								{/if}
							</button>
						{/if}
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
				class="md:tooltip md:tooltip-right flex justify-self-start pe-1 pb-1 transition-colors duration-300"
				data-tip="Add another outcome not already listed"
				aria-label="Add another outcome not already listed"
				onclick={handlePlusNewOutcome}
			>
				<Plus class="hover:bg-base-300 size-5" />
			</button>
		</div>
	</div>
</div>
