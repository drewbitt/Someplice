<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import ReviewGoalBox from '../goals/review-outcomes/ReviewGoalBox.svelte';
	import { journeyPageErrorStore } from '$src/lib/stores/errors';
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import { appLogger } from '$src/lib/utils/logger';

	export let goals: Goal[];
	export let intentions: Intention[];
	export let outcomes: Outcome[];

	let showSaveButton = false;
	let hasBeenSaved = false;

	let date = intentions[intentions.length - 1].date;
	let dateWithoutTime = date.split('T')[0];
	let outcomeForDate = outcomes.find((outcome) => outcome.date === dateWithoutTime);
	let newIntentionsToInsert: Omit<Intention, 'id'>[] = [];
	let maxOrderNumber = Math.max(...intentions.map((intention) => intention.orderNumber), 0);

	$: outcomeReviewed = outcomeForDate?.reviewed === 1;

	const handleReviewGoalBoxChange = () => {
		showSaveButton = true;
	};

	const handleSaveReview = async () => {
		let checkboxIntentions = Array.from(
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

		let intentionUpdateSuccess = false;
		let outcomeCreationSuccess = false;

		try {
			if (newIntentionsToInsert.length > 0) {
				let insertIds = await trpc().intentions.addMany.mutate(newIntentionsToInsert);

				const validInsertIds = insertIds?.filter((id) => id !== null) || [];

				if (validInsertIds.length !== newIntentionsToInsert.length) {
					appLogger.error("Some of the new intentions' ids were null.");
				}

				checkboxIntentions = checkboxIntentions.concat(
					validInsertIds.map((item) => ({
						intentionId: item.id as number,
						completed: 1
					}))
				);
			}

			await trpc().intentions.updateIntentionCompletionStatus.mutate(checkboxIntentions);
			intentionUpdateSuccess = true;

			await trpc().outcomes.createOrUpdateOutcome.mutate({
				outcome: outcomeToInsert,
				intentionIds: checkboxIntentions.map((item) => item.intentionId)
			});
			outcomeCreationSuccess = true;

			hasBeenSaved = true;
			showSaveButton = false;
		} catch (error) {
			if (error instanceof Error) {
				journeyPageErrorStore.setError(error.message);
			}
		} finally {
			if (intentionUpdateSuccess || outcomeCreationSuccess) {
				await invalidateAll();
			}
		}
	};

	function handleNewOutcomeTextChanged(event: CustomEvent<{ goalId: number; texts: string[] }>) {
		const { goalId, texts } = event.detail;

		texts.forEach((text, index) => {
			const newOrderNumber = maxOrderNumber + 1 + index;
			const existingIntentionIndex = newIntentionsToInsert.findIndex(
				(intention) => intention.goalId === goalId && intention.orderNumber === newOrderNumber
			);

			if (existingIntentionIndex !== -1) {
				if (text) {
					newIntentionsToInsert[existingIntentionIndex].text = text;
				} else {
					newIntentionsToInsert.splice(existingIntentionIndex, 1);
				}
			} else if (text) {
				newIntentionsToInsert.push({
					goalId: goalId,
					text: text,
					date: date,
					completed: 1,
					subIntentionQualifier: null,
					orderNumber: newOrderNumber
				});
			}
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
				on:updateNewOutcomeTexts={handleNewOutcomeTextChanged}
				on:plusNewOutcomeButtonPressed={handleReviewGoalBoxChange}
				on:checkboxClicked={handleReviewGoalBoxChange}
			/>
		{/if}
	{/each}
	{#if showSaveButton}
		<div class="flex w-full max-w-screen-2xl flex-col items-center">
			<div class="flex w-4/5 max-w-full min-w-min justify-end">
				<button class=" btn" on:click={handleSaveReview}>Save</button>
			</div>
		</div>
	{/if}
</div>
