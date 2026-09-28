<script lang="ts">
	import type { Goal, Intention, VerdictValue } from '$src/lib/trpc/types';
	import { lightenHSL } from '$src/lib/utils';
	import CalendarX from 'virtual:icons/lucide/calendar-x';
	import Plus from 'virtual:icons/lucide/plus';
	import Undo2 from 'virtual:icons/lucide/undo-2';
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
		onNotTodayToggled,
		onVerdictChanged
	}: {
		goal: Goal;
		intentions: Intention[];
		showTitle: boolean;
		hasBeenSaved: boolean;
		verdict?: { verdict: VerdictValue | null; note: string | null } | null;
		verdictAsBar?: boolean;
		onUpdateNewOutcomeTexts?: (detail: { goalId: number | null; texts: string[] }) => void;
		onPlusNewOutcomeButtonPressed?: (detail: { goalId: number | null }) => void;
		onCheckboxClicked?: (detail: { intentionId: number | null }) => void;
		onNotTodayToggled?: (detail: { intention: Intention }) => void;
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

	const lighterGoalColor = (color: string) => lightenHSL(color, 0.65);

	function handlePlusNewOutcome() {
		newOutcomeTexts = [...newOutcomeTexts, ''];
		onPlusNewOutcomeButtonPressed?.({ goalId: goal.id });
	}

	function handleCheckboxClick(intentionId: number | null) {
		onCheckboxClicked?.({ intentionId });
	}

	function handleNewOutcomeTextChanged(detail: { value: string; index: number }) {
		newOutcomeTexts[detail.index] = detail.value;
		newOutcomeTexts = newOutcomeTexts.slice();
		onUpdateNewOutcomeTexts?.({ goalId: goal.id, texts: newOutcomeTexts });
	}

	function emitVerdict(next: VerdictValue | null, note: string | null) {
		if (goal.id === null) return;
		onVerdictChanged?.({ goalId: goal.id, verdict: next, note });
	}

	function handleVerdictButton(next: VerdictValue) {
		emitVerdict(
			verdict?.verdict === next ? null : next,
			verdict?.verdict === next ? null : (verdict?.note ?? null)
		);
	}

	function handleVerdictNoteInput(event: Event) {
		if (!verdict?.verdict) return;
		emitVerdict(verdict.verdict, (event.currentTarget as HTMLInputElement).value);
	}

	const barText = $derived(
		verdict?.note ? `${goal.orderNumber} ⬅ ${verdict.note}` : `${goal.orderNumber}`
	);
	const barClass = $derived(
		verdict?.verdict === 'enough'
			? ''
			: verdict?.verdict === 'day_off'
				? 'border border-dashed bg-transparent'
				: 'bg-base-300 text-base-content'
	);
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
							class="goal-text text-lg leading-6 font-semibold"
							style="--goal-color: {goal.color}">{intention.text}</label
						>
						{#if onNotTodayToggled}
							<button
								type="button"
								class="btn btn-ghost btn-xs ml-1"
								aria-label={intention.status === 'not_today'
									? 'Restore intention'
									: 'Mark not today'}
								title={intention.status === 'not_today' ? 'Restore intention' : 'Mark not today'}
								onclick={() => onNotTodayToggled?.({ intention })}
							>
								{#if intention.status === 'not_today'}
									<Undo2 class="size-4" />
								{:else}
									<CalendarX class="size-4" />
								{/if}
							</button>
						{/if}
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
			{#if onVerdictChanged}
				{#if verdictAsBar && verdict?.verdict}
					<span
						class={`w-fit px-1.5 font-mono text-lg leading-none font-bold ${barClass}`}
						style={verdict.verdict === 'enough'
							? `background-color: ${lightenHSL(goal.color, 0.2)}; color: ${goal.color}`
							: ''}
					>
						{barText}
					</span>
				{:else}
					<div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
						<span class="text-base-content/80 text-sm">Is this enough?</span>
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
							class="input input-xs min-w-32 flex-1"
							placeholder="say more…"
							value={verdict?.verdict ? (verdict.note ?? '') : ''}
							disabled={!verdict?.verdict}
							oninput={handleVerdictNoteInput}
						/>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
