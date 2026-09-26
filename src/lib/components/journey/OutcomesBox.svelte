<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import ReviewGoalBox from '../goals/review-outcomes/ReviewGoalBox.svelte';
	import { journeyPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import { statusFromReviewCheckbox, type IntentionRow } from '$src/lib/utils';

	let {
		goals,
		intentions,
		outcomes
	}: { goals: Goal[]; intentions: IntentionRow[]; outcomes: Outcome[] } = $props();

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

	beforeNavigate((navigation) => {
		if (!newIntentionsToInsert.length) return;
		if (navigation.willUnload) {
			navigation.cancel();
		} else if (!confirm('Discard unsaved outcome text?')) {
			navigation.cancel();
		}
	});

	const handleReviewGoalBoxChange = () => {
		showSaveButton = true;
	};

	const handleSaveReview = async () => {
		const statuses = Array.from(
			document.querySelectorAll<HTMLInputElement>(
				`#journey-outcomes-box-${dateWithoutTime} .goal-review-item-content input[type="checkbox"]`
			)
		).map((checkbox) => {
			const intentionId = Number(checkbox.value);
			const intention = intentions.find((intention) => intention.id === intentionId);
			return { intentionId, status: statusFromReviewCheckbox(intention, checkbox.checked) };
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
				statuses
			});
			saved = true;
			hasBeenSaved = true;
			showSaveButton = false;
			newIntentionsToInsert = [];
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
					status: 'done',
					subIntentionQualifier: null,
					orderNumber: 0
				});
			}
		}
		newIntentionsToInsert.forEach((intention, index) => {
			intention.orderNumber = maxOrderNumber + 1 + index;
		});
	}

	const handleNotTodayToggled = async (detail: { intention: IntentionRow }) => {
		const { intention } = detail;
		const status = intention.status === 'not_today' ? 'pending' : 'not_today';
		try {
			await trpc().intentions.edit.mutate({ ...intention, status });
			intention.status = status;
		} catch (error) {
			if (error instanceof Error) {
				journeyPageErrorStore.setError(error.message);
			}
		}
	};
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
				onUpdateNewOutcomeTexts={handleNewOutcomeTextChanged}
				onPlusNewOutcomeButtonPressed={handleReviewGoalBoxChange}
				onCheckboxClicked={handleReviewGoalBoxChange}
				onNotTodayToggled={handleNotTodayToggled}
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
