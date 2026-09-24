<script lang="ts">
	import type { Goal, Intention, Outcome, PriorityWithGoal } from '$src/lib/trpc/types';
	import ReviewGoalBox from '../goals/review-outcomes/ReviewGoalBox.svelte';
	import PriorityModal from '../shared/PriorityModal.svelte';
	import { journeyPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';

	let {
		goals,
		intentions,
		outcomes,
		priorities = []
	}: {
		goals: Goal[];
		intentions: Intention[];
		outcomes: Outcome[];
		priorities?: PriorityWithGoal[];
	} = $props();

	let showSaveButton = $state(false);
	let hasBeenSaved = $state(false);
	let showPriorityModal = $state(false);
	let priorityModalGoal = $state<Goal | null>(null);

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

	const handleNewPriority = (detail: { goalId: number | null }) => {
		const goal = goals.find((goal) => goal.id === detail.goalId);
		if (!goal) return;
		priorityModalGoal = goal;
		showPriorityModal = true;
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
				completions: checkboxIntentions
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
				priority={priorities.find((priority) => priority.goalId === goal.id)}
				onUpdateNewOutcomeTexts={handleNewOutcomeTextChanged}
				onPlusNewOutcomeButtonPressed={handleReviewGoalBoxChange}
				onCheckboxClicked={handleReviewGoalBoxChange}
				onNewPriority={handleNewPriority}
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

{#if priorityModalGoal}
	<PriorityModal
		bind:showModal={showPriorityModal}
		goal={priorityModalGoal}
		onError={(message) => journeyPageErrorStore.setError(message)}
	/>
{/if}
