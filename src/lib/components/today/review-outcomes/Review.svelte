<script lang="ts">
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention, Outcome, VerdictValue } from '$src/lib/trpc/types';
	import theme from '$lib/stores/theme';
	import ReviewGoalBox from '../../goals/review-outcomes/ReviewGoalBox.svelte';
	import { localeCurrentDate } from '$src/lib/utils';
	import { invalidateAll, beforeNavigate } from '$app/navigation';
	import { todayPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		intentionsOnLatestDate,
		setHasOutstandingOutcome
	}: { intentionsOnLatestDate: Intention[]; setHasOutstandingOutcome: (value: boolean) => void } =
		$props();

	let intentionDate = $derived(
		intentionsOnLatestDate[0] ? new Date(intentionsOnLatestDate[0].date) : new Date()
	);
	let showPageLoadingSpinner = $state(true);

	let daysAgo = $state(0);
	let goalsOnDate = $state<Goal[]>([]);
	let intentionsOnDate = $state<Intention[]>([]);
	let newIntentionsToInsert = $state<Omit<Intention, 'id'>[]>([]);
	let maxOrderNumber = $state<number>(0);
	let hasBeenSaved = $state(false);
	let verdicts = new SvelteMap<number, { verdict: VerdictValue | null; note: string | null }>();

	beforeNavigate((navigation) => {
		if (!newIntentionsToInsert.length && verdicts.size === 0) return;
		if (navigation.willUnload) {
			navigation.cancel();
		} else if (!confirm('Discard unsaved outcome text?')) {
			navigation.cancel();
		}
	});

	$effect(() => {
		if (intentionsOnLatestDate[0]) {
			intentionDate = new Date(intentionsOnLatestDate[0].date);
		}
	});
	$effect(() => {
		if (!intentionsOnLatestDate || intentionsOnLatestDate.length === 0) {
			showPageLoadingSpinner = false;
			goalsOnDate = [];
			intentionsOnDate = [];
			daysAgo = 0;
			return;
		}

		const targetDate = new Date(intentionDate);
		const currentDate = localeCurrentDate();
		// difference in calendar days (UTC), not elapsed 24h periods
		daysAgo = Math.round(
			(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()) -
				Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())) /
				86400000
		);

		let cancelled = false;
		showPageLoadingSpinner = true;

		(async () => {
			try {
				const [goalsResult, intentionsResult] = await Promise.all([
					listGoalsOnDate(targetDate),
					listIntentionsOnDate(targetDate)
				]);
				if (cancelled) return;
				goalsOnDate = goalsResult;
				intentionsOnDate = intentionsResult;
			} catch (error) {
				if (cancelled) return;
				if (error instanceof Error) {
					todayPageErrorStore.setError(error.message);
				}
			} finally {
				if (!cancelled) {
					showPageLoadingSpinner = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});
	$effect(() => {
		if (intentionsOnDate) {
			maxOrderNumber = Math.max(...intentionsOnDate.map((intention) => intention.orderNumber), 0);
		}
	});

	const listGoalsOnDate = async (date: Date) => {
		const goals = await trpc().goals.listGoalsOnDate.query({
			active: 1,
			date: date
		});
		return goals;
	};
	const listIntentionsOnDate = async (date: Date) => {
		const intentions = await trpc().intentions.list.query({
			startDate: date,
			endDate: date
		});
		return intentions;
	};
	const handleSaveReview = async () => {
		const checkboxIntentions = Array.from(
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

		let saved = false;

		try {
			await trpc().outcomes.saveReview.mutate({
				outcome: outcomeToInsert,
				newIntentions: newIntentionsToInsert,
				completions: checkboxIntentions,
				verdicts: [...verdicts.entries()].flatMap(([goalId, verdict]) =>
					verdict.verdict === null ? [] : [{ goalId, verdict: verdict.verdict, note: verdict.note }]
				)
			});
			saved = true;
			hasBeenSaved = true;
			setHasOutstandingOutcome(false);
			newIntentionsToInsert = [];
			verdicts.clear();
		} catch (error) {
			if (error instanceof Error) {
				todayPageErrorStore.setError(error.message);
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
					date: intentionDate.toISOString(),
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

	function handleVerdictChanged(detail: {
		goalId: number;
		verdict: VerdictValue | null;
		note: string | null;
	}) {
		const { goalId, verdict, note } = detail;
		if (verdict === null && !note) {
			verdicts.delete(goalId);
			return;
		}
		verdicts.set(goalId, { verdict, note });
	}

	let darkMode = $derived(theme.current === 'dark');
</script>

<div
	class="flex flex-col items-center p-4"
	class:shadow-sm={darkMode}
	class:shadow-black={darkMode}
	class:shadow-xl={!darkMode}
	id="review-goals-form"
>
	<section class="w-full items-center p-4 pb-6 2xl:pb-7">
		<h1 class="mb-5 text-center text-2xl">
			Finish reviewing {intentionDate.toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'short',
				day: 'numeric'
			})}
		</h1>
		<p class="mb-5 text-center text-lg">
			Reflect on what you did towards your goals {daysAgo === 1
				? 'yesterday'
				: `${daysAgo} days ago`}:
		</p>
		{#if showPageLoadingSpinner}
			<div class="flex justify-center">
				<span class="loading loading-spinner loading-lg motion-reduce:[animation-duration:2s]"
				></span>
			</div>
		{:else}
			<div role="list" id="goal-outcome-list-container" class="grid place-items-center gap-6">
				{#each goalsOnDate as goal (goal.id)}
					<ReviewGoalBox
						{goal}
						{hasBeenSaved}
						showTitle={true}
						intentions={intentionsOnDate}
						verdict={verdicts.get(goal.id ?? -1) ?? null}
						onUpdateNewOutcomeTexts={handleNewOutcomeTextChanged}
						onVerdictChanged={handleVerdictChanged}
					/>
				{/each}
			</div>
		{/if}
	</section>
	<div class="mr-6 flex w-full max-w-screen-2xl flex-col items-center md:mr-6 2xl:mr-0">
		<div class="flex w-4/5 max-w-full min-w-min justify-end gap-2">
			<button class="btn" onclick={handleSaveReview}>Save</button>
		</div>
	</div>
</div>
