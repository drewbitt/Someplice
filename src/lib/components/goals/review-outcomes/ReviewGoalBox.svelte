<script lang="ts">
	import type { Goal, Intention, VerdictValue } from '$src/lib/trpc/types';
	import { evenEvenLighterHSLColor } from '$src/lib/utils';
	import Plus from 'virtual:icons/lucide/plus';
	import NewOutcomeTextBox from './NewOutcomeTextBox.svelte';

	let {
		goal,
		intentions,
		showTitle,
		hasBeenSaved,
		verdict = null,
		verdictAsBar = false,
		onUpdateNewOutcomeTexts,
		onPlusNewOutcomeButtonPressed,
		onCheckboxClicked,
		onVerdictChanged
	}: {
		goal: Goal;
		intentions: Intention[];
		showTitle: boolean;
		hasBeenSaved: boolean;
		verdict?: { verdict: VerdictValue | null; note: string | null } | null;
		// journey renders the stored verdict as a colored "N ⬅ <note>" bar
		verdictAsBar?: boolean;
		onUpdateNewOutcomeTexts?: (detail: { goalId: number | null; texts: string[] }) => void;
		onPlusNewOutcomeButtonPressed?: (detail: { goalId: number | null }) => void;
		onCheckboxClicked?: (detail: { intentionId: number | null }) => void;
		onVerdictChanged?: (detail: {
			goalId: number;
			verdict: VerdictValue | null;
			note: string | null;
		}) => void;
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

	function emitVerdict(next: VerdictValue | null, note: string | null) {
		if (goal.id === null) return;
		onVerdictChanged?.({ goalId: goal.id, verdict: next, note });
	}

	function handleVerdictButton(next: VerdictValue) {
		// clicking the selected verdict again clears it
		emitVerdict(verdict?.verdict === next ? null : next, verdict?.note ?? null);
	}

	function handleVerdictNoteInput(event: Event) {
		emitVerdict(verdict?.verdict ?? null, (event.currentTarget as HTMLInputElement).value);
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
			{#if verdict?.verdict === 'day_off'}
				<p class="text-base-content/60 italic">day off</p>
			{:else if intentions.filter((intention) => intention.goalId === goal.id).length > 0}
				{#each intentions.filter((intention) => intention.goalId === goal.id) as intention (intention.id)}
					<div class="flex">
						<input
							type="checkbox"
							id="intention-{intention.id}"
							value={intention.id}
							checked={Boolean(intention.completed)}
							class="checkbox-md mr-2 shrink-0"
							onclick={() => handleCheckboxClick(intention.id)}
						/>
						<label
							for="intention-{intention.id}"
							class="goal-text text-lg leading-6 font-semibold"
							style="--goal-color: {goal.color}">{intention.text}</label
						>
					</div>
				{/each}
			{:else}
				<p class="text-base-content/60 italic">NOTHING</p>
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
			<div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
				{#if verdictAsBar && verdict?.verdict}
					<span
						style="background-color: {lighterGoalColor(goal.color)}; color: {goal.color}"
						class="px-1.5 font-mono text-lg leading-none font-bold"
					>
						{goal.orderNumber} ⬅ {verdict.verdict === 'day_off' ? 'day off' : verdict.note}
					</span>
				{:else}
					<span class="text-base-content/80 text-sm">Is this enough?</span>
				{/if}
				<button
					type="button"
					class="btn btn-xs"
					class:btn-active={verdict?.verdict === 'enough'}
					onclick={() => handleVerdictButton('enough')}
				>
					yes
				</button>
				<button
					type="button"
					class="btn btn-xs"
					class:btn-active={verdict?.verdict === 'not_enough'}
					onclick={() => handleVerdictButton('not_enough')}
				>
					no
				</button>
				<button
					type="button"
					class="btn btn-xs"
					class:btn-active={verdict?.verdict === 'day_off'}
					onclick={() => handleVerdictButton('day_off')}
				>
					day off
				</button>
				<input
					type="text"
					class="input input-xs input-bordered min-w-32 flex-1"
					placeholder="say more…"
					value={verdict?.note ?? ''}
					oninput={handleVerdictNoteInput}
				/>
			</div>
		</div>
	</div>
</div>
