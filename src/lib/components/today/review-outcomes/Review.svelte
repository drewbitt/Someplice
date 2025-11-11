<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention, Outcome } from '$src/lib/trpc/types';
	import { Box, Button, colorScheme, createStyles } from '@svelteuidev/core';
	import ReviewGoalBox from '../../goals/review-outcomes/ReviewGoalBox.svelte';
	import { localeCurrentDate } from '$src/lib/utils';
	import { appLogger } from '$src/lib/utils/logger';
	import { invalidateAll } from '$app/navigation';
	import { todayPageErrorStore } from '$src/lib/stores/errors';

	export let intentionsOnLatestDate: Intention[];
	export let setHasOutstandingOutcome: (value: boolean) => void;

	const intentionDate = new Date(intentionsOnLatestDate[0].date);
	let showPageLoadingSpinner = true;
	let daysAgo: number;
	let goalsOnDate: Goal[];
	let intentionsOnDate: Intention[];
	let newIntentionsToInsert: Omit<Intention, 'id'>[] = [];
	let maxOrderNumber: number;
	let hasBeenSaved = false;

	$: {
		const currentDate = localeCurrentDate();
		const timeDiff = Math.abs(currentDate.getTime() - intentionDate.getTime());
		daysAgo = Math.ceil(timeDiff / (1000 * 3600 * 24));

		Promise.all([listGoalsOnDate(intentionDate), listIntentionsOnDate(intentionDate)])
			.then(([goalsResult, intentionsResult]) => {
				goalsOnDate = goalsResult;
				intentionsOnDate = intentionsResult;
				showPageLoadingSpinner = false; // turn off loading spinner when all promises are resolved
			})
			.catch((error) => {
				if (error instanceof Error) {
					todayPageErrorStore.setError(error.message);
				}
				showPageLoadingSpinner = false;
			});
	}
	$: if (intentionsOnDate) {
		maxOrderNumber = Math.max(...intentionsOnDate.map((intention) => intention.orderNumber), 0);
	}

	const listGoalsOnDate = async (date: Date) => {
		const goals = await trpc($page).goals.listGoalsOnDate.query({
			active: 1,
			date: date
		});
		return goals;
	};
	const listIntentionsOnDate = async (date: Date) => {
		const intentions = await trpc($page).intentions.list.query({
			startDate: date,
			endDate: date
		});
		return intentions;
	};
	const handleSaveReview = async () => {
		// Get the values of the intention checkboxes
		let checkboxIntentions = Array.from(
			document.querySelectorAll<HTMLInputElement>(
				'.goal-review-item-content input[type="checkbox"]'
			)
		).map((checkbox) => {
			return { intentionId: Number(checkbox.value), completed: Number(checkbox.checked) };
		});

		const outcomeToInsert: Omit<Outcome, 'id'> = {
			date: intentionDate.toISOString().split('T')[0],
			reviewed: 1
		};

		let intentionUpdateSuccess = false;
		let outcomeCreationSuccess = false;

		try {
			// First, insert any newly added outcomes to the intentions
			if (newIntentionsToInsert.length > 0) {
				let insertIds = await trpc($page).intentions.addMany.mutate(newIntentionsToInsert);

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
			await trpc($page).intentions.updateIntentionCompletionStatus.mutate(checkboxIntentions);
			intentionUpdateSuccess = true;

			// Create or update the outcome
			await trpc($page).outcomes.createOrUpdateOutcome.mutate({
				outcome: outcomeToInsert,
				intentionIds: checkboxIntentions.map((item) => item.intentionId)
			});
			outcomeCreationSuccess = true;

			hasBeenSaved = true;
			setHasOutstandingOutcome(false);
			// TODO: show success toast or notification
		} catch (error) {
			if (error instanceof Error) {
				todayPageErrorStore.setError(error.message);
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
					date: intentionDate.toISOString(),
					completed: 1,
					subIntentionQualifier: null,
					orderNumber: newOrderNumber
				});
			}
		});
	}

	const useStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'white'
			}
		}
	}));
	$: darkMode = $colorScheme === 'dark';
	$: ({ cx, getStyles } = useStyles());
</script>

<Box
	class={cx(
		'flex flex-col items-center p-4',
		darkMode ? 'shadow shadow-black' : 'shadow-xl',
		getStyles()
	)}
	id="review-goals-form"
>
	<section class="w-full items-center p-4 pb-6 2xl:pb-7">
		<h1 class="mb-5 text-center text-2xl">
			Finish reviewing {new Date(intentionsOnLatestDate[0].date).toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric'
			})}
		</h1>
		<p class="mb-5 text-center text-lg">
			Reflect on what you did towards your goals {daysAgo} days ago:
		</p>
		{#if showPageLoadingSpinner}
			<div class="flex justify-center">
				<span class="daisy-loading daisy-loading-spinner daisy-loading-lg" />
			</div>
		{:else}
			<div role="list" id="goal-outcome-list-container" class="grid place-items-center gap-6">
				{#each goalsOnDate as goal (goal.id)}
					<ReviewGoalBox
						{goal}
						{hasBeenSaved}
						showTitle={true}
						intentions={intentionsOnDate}
						on:updateNewOutcomeTexts={handleNewOutcomeTextChanged}
					/>
				{/each}
			</div>
		{/if}
	</section>
	<!-- Mimic the styling of ReviewGoalBox so the Save button aligns properly -->
	<!-- TODO: fix conditional mr padding as ReviewGoalBox is doing something funky I'm just trying to mimic-->
	<Box class="mr-6 flex w-full max-w-screen-2xl flex-col items-center md:mr-6 2xl:mr-0">
		<Box class="flex w-4/5 max-w-full min-w-min justify-end gap-2">
			<Button on:click={handleSaveReview}>Save</Button>
		</Box>
	</Box>
</Box>
