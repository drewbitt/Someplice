<script lang="ts">
	import type { Goal, Intention, Outcome, VerdictValue } from '$src/lib/trpc/types';
	import type { OutcomeVerdicts } from '$src/lib/types/data';
	import type { Selectable } from 'kysely';
	import ReviewGoalBox from '../goals/review-outcomes/ReviewGoalBox.svelte';
	import { journeyPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		goals,
		intentions,
		outcomes,
		verdicts = []
	}: {
		goals: Goal[];
		intentions: Intention[];
		outcomes: Outcome[];
		verdicts?: Selectable<OutcomeVerdicts>[];
	} = $props();

	let showSaveButton = $state(false);
	let hasBeenSaved = $state(false);

	let date = $derived(intentions[intentions.length - 1].date);
	let dateWithoutTime = $derived(date.split('T')[0]);
	let outcomeForDate = $derived(outcomes.find((outcome) => outcome.date === dateWithoutTime));
	let newIntentionsToInsert: Omit<Intention, 'id'>[] = [];
	let maxOrderNumber = $derived(
		Math.max(...intentions.map((intention) => intention.orderNumber), 0)
	);

	let outcomeReviewed = $derived(outcomeForDate?.reviewed === 1);

	let storedVerdictMap = $derived(
		new Map(
			verdicts
				.filter((verdict) => verdict.outcomeId === outcomeForDate?.id)
				.map((verdict) => [
					verdict.goalId,
					{ verdict: verdict.verdict as VerdictValue, note: verdict.note }
				])
		)
	);
	let verdictEdits = new SvelteMap<number, { verdict: VerdictValue | null; note: string | null }>();

	const verdictForGoal = (goalId: number | null) => {
		if (goalId === null) return null;
		return verdictEdits.get(goalId) ?? storedVerdictMap.get(goalId) ?? null;
	};

	beforeNavigate((navigation) => {
		if (!newIntentionsToInsert.length && verdictEdits.size === 0) return;
		if (navigation.willUnload) {
			navigation.cancel();
		} else if (!confirm('Discard unsaved outcome text?')) {
			navigation.cancel();
		}
	});

	const handleReviewGoalBoxChange = () => {
		showSaveButton = true;
	};

	const handleVerdictChanged = (detail: {
		goalId: number;
		verdict: VerdictValue | null;
		note: string | null;
	}) => {
		const { goalId, verdict, note } = detail;
		if (verdict === null && !note) {
			verdictEdits.delete(goalId);
		} else {
			verdictEdits.set(goalId, { verdict, note });
		}
		showSaveButton = true;
	};

	const handleSaveReview = async () => {
		const checkboxIntentions = Array.from(
			document.querySelectorAll<HTMLInputElement>(
				`#journey-outcomes-box-${dateWithoutTime} .goal-review-item-content input[type="checkbox"]`
			)
		).map((checkbox) => {
			return { intentionId: Number(checkbox.value), completed: Number(checkbox.checked) };
		});

		const outcomeToInsert: Omit<Outcome, 'id'> = {
			date: date.split('T')[0],
			reviewed: 1
		};

		let saved = false;

		try {
			await trpc().outcomes.saveReview.mutate({
				outcome: outcomeToInsert,
				newIntentions: newIntentionsToInsert,
				completions: checkboxIntentions,
				// edits override stored rows; entries with no verdict selected are dropped
				verdicts: [...new Map([...storedVerdictMap, ...verdictEdits]).entries()].flatMap(
					([goalId, verdict]) =>
						verdict.verdict === null
							? []
							: [{ goalId, verdict: verdict.verdict, note: verdict.note }]
				)
			});
			saved = true;
			hasBeenSaved = true;
			showSaveButton = false;
			newIntentionsToInsert = [];
			verdictEdits.clear();
		} catch (error) {
			if (error instanceof Error) {
				journeyPageErrorStore.setError(error.message);
			}
		} finally {
			if (saved) {
				await invalidateAll();
			}
		}
	};

	function handleNewOutcomeTextChanged(detail: { goalId: number | null; texts: string[] }) {
		const { goalId, texts } = detail;
		if (goalId === null) return;

		// Rebuild this goal's pending rows from its latest texts, then renumber
		// across all pending rows — (DATE(date), orderNumber) must stay unique
		// across goals, so numbering per goal would collide.
		newIntentionsToInsert = newIntentionsToInsert.filter(
			(intention) => intention.goalId !== goalId
		);
		for (const text of texts) {
			if (text) {
				newIntentionsToInsert.push({
					goalId: goalId,
					text: text,
					date: date,
					completed: 1,
					subIntentionQualifier: null,
					orderNumber: 0
				});
			}
		}
		newIntentionsToInsert.forEach((intention, index) => {
			intention.orderNumber = maxOrderNumber + 1 + index;
		});
	}
</script>

<div
	class="grid gap-5"
	id={`journey-outcomes-box-${dateWithoutTime}`}
	aria-label="List of Outcomes for the day"
>
	{#each goals as goal (goal.id)}
		{#if outcomeReviewed}
			<ReviewGoalBox
				{goal}
				{intentions}
				{hasBeenSaved}
				showTitle={false}
				verdict={verdictForGoal(goal.id)}
				verdictAsBar={true}
				onUpdateNewOutcomeTexts={handleNewOutcomeTextChanged}
				onPlusNewOutcomeButtonPressed={handleReviewGoalBoxChange}
				onCheckboxClicked={handleReviewGoalBoxChange}
				onVerdictChanged={handleVerdictChanged}
			/>
		{/if}
	{/each}
	{#if showSaveButton}
		<div class="flex w-full max-w-screen-2xl flex-col items-center">
			<div class="flex w-4/5 max-w-full min-w-min justify-end">
				<button class="btn" onclick={handleSaveReview}>Save</button>
			</div>
		</div>
	{/if}
</div>
