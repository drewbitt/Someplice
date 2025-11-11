<script lang="ts">
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import { Box, Button } from '@svelteuidev/core';
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

	// TODO: This is duplicated in src/lib/components/today/review-outcomes/Review.svelte
	const handleSaveReview = async () => {
		// Get the values of the intention checkboxes
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
			// First, insert any newly added outcomes to the intentions
			if (newIntentionsToInsert.length > 0) {
				let insertIds = await trpc().intentions.addMany.mutate(newIntentionsToInsert);

				// Filter out any null ids
				const validInsertIds = insertIds?.filter((id) => id !== null) || [];

				// TODO: Show error to user, but is this even possible? Connection problems?
				if (validInsertIds.length !== newIntentionsToInsert.length) {
					appLogger.error("Some of the new intentions' ids were null.");
				}

				// Add the new intention ids to the checkboxIntentions array
				checkboxIntentions = checkboxIntentions.concat(
					validInsertIds.map((item) => ({
						intentionId: item.id as number,
						completed: 1
					}))
				);
			}

			// Update the completion status of intentions
			await trpc().intentions.updateIntentionCompletionStatus.mutate(checkboxIntentions);
			intentionUpdateSuccess = true;

			// Create or update the outcome
			await trpc().outcomes.createOrUpdateOutcome.mutate({
				outcome: outcomeToInsert,
				intentionIds: checkboxIntentions.map((item) => item.intentionId)
			});
			outcomeCreationSuccess = true;

			hasBeenSaved = true;
			showSaveButton = false;
			// TODO: show success toast or notification
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

	// TODO: This is duplicated in src/lib/components/today/review-outcomes/Review.svelte
	function handleNewOutcomeTextChanged(event: CustomEvent<{ goalId: number; texts: string[] }>) {
		const { goalId, texts } = event.detail;

		texts.forEach((text, index) => {
			const newOrderNumber = maxOrderNumber + 1 + index; // ensures that the new intention will be at the bottom of the list
			const existingIntentionIndex = newIntentionsToInsert.findIndex(
				(intention) => intention.goalId === goalId && intention.orderNumber === newOrderNumber
			);

			if (existingIntentionIndex !== -1) {
				if (text) {
					// Update the existing intention
					newIntentionsToInsert[existingIntentionIndex].text = text;
				} else {
					// Remove the intention if its text is the empty string
					newIntentionsToInsert.splice(existingIntentionIndex, 1);
				}
			} else if (text) {
				// Add a new intention
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
		<!-- Mimic the styling of ReviewGoalBox so the Save button aligns properly -->
		<Box class="flex w-full max-w-screen-2xl flex-col items-center">
			<Box class="flex w-4/5 max-w-full min-w-min justify-end">
				<Button on:click={handleSaveReview}>Save</Button>
			</Box>
		</Box>
	{/if}
</div>
