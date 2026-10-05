<script lang="ts">
	import type {
		Goal,
		Intention,
		IntentionStatus,
		Outcome,
		OutcomeVerdict,
		Priority,
		VerdictValue
	} from '#lib/trpc/types.js';
	import ReviewGoalBox from '../goals/review-outcomes/ReviewGoalBox.svelte';
	import PriorityModal from '../shared/PriorityModal.svelte';
	import { journeyPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { refreshAll, beforeNavigate } from '$app/navigation';
	import { trpc } from '#lib/trpc/client.js';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		goals,
		intentions,
		outcomes,
		verdicts = [],
		priorities = [],
		date: dateProp,
		onDayChanged

		// Day date as ISO midnight; used when the day has no intentions to take it from.
		// Called after a write so extras-supplied days can be re-fetched;
		// refreshAll alone only refreshes server-loaded data.
	}: {
		goals: Goal[];
		intentions: Intention[];
		outcomes: Outcome[];
		verdicts?: OutcomeVerdict[];
		priorities?: Priority[];
		date?: string;
		onDayChanged?: () => void | Promise<void>;
	} = $props();

	let showSaveButton = $state(false);
	let saveRevision = $state(0);
	let saving = $state(false);
	let showPriorityModal = $state(false);
	let priorityOverrides = $state<Priority[] | null>(null);
	let priorityModalGoal = $state<Goal | null>(null);

	let date = $derived(intentions[intentions.length - 1]?.date ?? dateProp ?? '');
	let dateWithoutTime = $derived(date.split('T')[0]);
	let outcomeForDate = $derived(outcomes.find((outcome) => outcome.date === dateWithoutTime));
	let newIntentionsToInsert: Omit<Intention, 'id'>[] = [];
	let maxOrderNumber = $derived(
		Math.max(...intentions.map((intention) => intention.orderNumber), 0)
	);

	let outcomeReviewed = $derived(outcomeForDate?.reviewed === 1);
	let storedVerdictMap = $derived(
		new Map<number, { verdict: VerdictValue; note: string | null }>(
			verdicts
				.filter((verdict) => verdict.outcomeId === outcomeForDate?.id)
				.map((verdict) => [
					verdict.goalId,
					{ verdict: verdict.verdict, note: verdict.note ?? null }
				])
		)
	);
	let verdictEdits = new SvelteMap<number, { verdict: VerdictValue | null; note: string | null }>();
	let statusOverrides = new SvelteMap<number, IntentionStatus>();
	let displayIntentions = $derived(
		intentions.map((intention) =>
			intention.id !== null && statusOverrides.has(intention.id)
				? { ...intention, status: statusOverrides.get(intention.id)! }
				: intention
		)
	);

	const verdictForGoal = (goalId: number | null) => {
		if (goalId === null) return null;
		return verdictEdits.get(goalId) ?? storedVerdictMap.get(goalId) ?? null;
	};

	beforeNavigate((navigation) => {
		if (navigation.shallow) return;
		if (!newIntentionsToInsert.length && verdictEdits.size === 0 && statusOverrides.size === 0)
			return;

		if (navigation.willUnload) {
			navigation.cancel();
		} else if (!confirm('Discard unsaved review changes?')) {
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
		// An empty emit clears a pending edit, but when a stored verdict exists it
		// must be recorded as an explicit deletion instead of reverting to stored.
		if (verdict === null && !note && !storedVerdictMap.has(goalId)) {
			verdictEdits.delete(goalId);
		} else {
			verdictEdits.set(goalId, { verdict, note });
		}
		showSaveButton = true;
	};

	const handleNewPriority = (detail: { goalId: number | null }) => {
		const goal = goals.find((goal) => goal.id === detail.goalId);
		if (!goal) return;
		priorityModalGoal = goal;
		showPriorityModal = true;
	};

	const handleCheckboxClicked = ({ intentionId }: { intentionId: number | null }) => {
		const intention = displayIntentions.find((row) => row.id === intentionId);
		if (intentionId === null || !intention) return;
		statusOverrides.set(intentionId, intention.status === 'done' ? 'pending' : 'done');
		showSaveButton = true;
	};

	const handleSaveReview = async () => {
		if (saving) return;
		saving = true;
		const statuses = [...statusOverrides].map(([intentionId, status]) => ({ intentionId, status }));

		const outcomeToInsert: Omit<Outcome, 'id'> = {
			date: dateWithoutTime,
			reviewed: 1
		};

		try {
			const verdictsToSave = new SvelteMap<
				number,
				{ verdict: VerdictValue | null; note: string | null }
			>();
			for (const [goalId, verdict] of storedVerdictMap) {
				verdictsToSave.set(goalId, verdict);
			}
			for (const [goalId, verdict] of verdictEdits) {
				verdictsToSave.set(goalId, verdict);
			}
			await trpc().outcomes.saveReview.mutate({
				outcome: outcomeToInsert,
				newIntentions: newIntentionsToInsert,
				statuses,
				verdicts: [...verdictsToSave.entries()].flatMap(([goalId, verdict]) =>
					verdict.verdict === null ? [] : [{ goalId, verdict: verdict.verdict, note: verdict.note }]
				)
			});
			saveRevision += 1;
			showSaveButton = false;
			newIntentionsToInsert = [];
			verdictEdits.clear();
			statusOverrides.clear();
			await refreshAll();
			await onDayChanged?.();
		} catch (error) {
			if (error instanceof Error) {
				journeyPageErrorStore.setError(error.message);
			}
		} finally {
			saving = false;
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
					goalId,
					text,
					date,
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

	// The ✕ toggle used to write immediately — a stray click rewrote a past day
	// and the resulting refreshAll discarded pending checkbox/verdict edits.
	// It now stages a pending status change that saveReview writes with the rest.
	const handleNotTodayToggled = (detail: { intention: Intention }) => {
		const { intention } = detail;
		if (intention.id === null) return;
		const next = intention.status === 'not_today' ? 'pending' : 'not_today';
		const stored = intentions.find((i) => i.id === intention.id);
		if (stored && stored.status === next) {
			statusOverrides.delete(intention.id);
		} else {
			statusOverrides.set(intention.id, next);
		}
		showSaveButton = true;
	};
</script>

<fieldset
	disabled={saving}
	class="grid gap-5"
	id={`journey-outcomes-box-${dateWithoutTime}`}
	aria-label="List of Outcomes for the day"
>
	{#each goals as goal (goal.id)}
		{#if outcomeReviewed}
			<ReviewGoalBox
				{goal}
				intentions={displayIntentions}
				{saveRevision}
				showTitle={false}
				verdict={verdictForGoal(goal.id)}
				verdictAsBar={!showSaveButton}
				priority={(priorityOverrides ?? priorities).find((priority) => priority.goalId === goal.id)}
				onUpdateNewOutcomeTexts={handleNewOutcomeTextChanged}
				onPlusNewOutcomeButtonPressed={handleReviewGoalBoxChange}
				onCheckboxClicked={handleCheckboxClicked}
				onNotTodayToggled={handleNotTodayToggled}
				onVerdictChanged={handleVerdictChanged}
				onNewPriority={handleNewPriority}
			/>
		{/if}
	{/each}
	{#if showSaveButton}
		<div class="flex w-full max-w-screen-2xl flex-col items-center">
			<div class="flex w-4/5 max-w-full min-w-min justify-end">
				<button class="btn" disabled={saving} onclick={handleSaveReview}>Save</button>
			</div>
		</div>
	{/if}
</fieldset>

{#if priorityModalGoal}
	<PriorityModal
		bind:showModal={showPriorityModal}
		goal={priorityModalGoal}
		onSaved={async () => {
			priorityOverrides = await trpc().priorities.list.query({ activeOnly: true });
		}}
		onError={(message) => journeyPageErrorStore.setError(message)}
	/>
{/if}
