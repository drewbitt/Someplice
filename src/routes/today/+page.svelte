<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '$src/lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import Review from '$src/lib/components/today/review-outcomes/Review.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { dayOfWeekFromDate } from '$src/lib/utils';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import { todaysIntentionsStore } from '$src/lib/stores/localStorage';
	import { onMount } from 'svelte';
	import { appLogger } from '$src/lib/utils/logger';

	let { data }: { data: PageServerData } = $props();
	type Intentions = (typeof data.intentions)[0];

	let intentions = data.intentions;
	let intentionsOnLatestDate = data.intentionsOnLatestDate;
	let additionalIntentions: Intentions[] = [];
	let validIntentions: boolean;
	let showValidIntentionsNotification = false;
	let showAdditionalIntentionsTextArea = false;
	let showDBErrorNotification = false;
	let intentionsFromServer: Intentions[] = data.intentions;
	let hasOutstandingOutcome = false;
	let showPageLoadingSpinner = false;

	onMount(() => {
		todaysIntentionsStore.initialize();
		if ($todaysIntentionsStore && !noGoals && !noIntentions) {
			showAdditionalIntentionsTextArea = true;
		}
	});

	let noGoals = $derived(data.goals.length === 0);
	let noIntentions = $derived(data.intentions.length === 0);
	$effect(() => {
		if (showDBErrorNotification) {
			setTimeout(() => {
				showDBErrorNotification = false;
			}, 5000);
		}
	});
	$effect(() => {
		if (!noIntentions || hasOutstandingOutcome || noGoals) {
			showPageLoadingSpinner = false;
			return;
		}

		let cancelled = false;
		showPageLoadingSpinner = true;

		(async () => {
			try {
				const result = await isOldOutcomeOutstanding();
				if (cancelled) return;

				if (result) {
					hasOutstandingOutcome = true;
				} else {
					showPageLoadingSpinner = false;
				}
			} catch {
				if (!cancelled) {
					showPageLoadingSpinner = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	const setHasOutstandingOutcome = (value: boolean) => {
		hasOutstandingOutcome = value;
	};

	const addIntentions = async () => {
		const addResult = await trpc().intentions.updateIntentions.mutate({
			intentions: intentions
		});
		if (addResult?.length > 0) {
			await invalidateAll();
			intentions = data.intentions;
			intentionsFromServer = data.intentions;
		} else {
			showDBErrorNotification = true;
		}
	};

	const updateIntentions = async () => {
		const updateResult = await handleUpdateIntentions();
		if (updateResult?.length > 0) {
			handleHideAdditionalIntentionsTextArea();
			await invalidateAll();
			intentions = data.intentions;
			intentionsFromServer = data.intentions;
		} else {
			showDBErrorNotification = true;
		}
	};

	const isOldOutcomeOutstanding = async () => {
		if (intentionsOnLatestDate && intentionsOnLatestDate.length > 0) {
			const latestIntentionDate = new Date(intentionsOnLatestDate[0].date);
			const outcomes = await listOutcomesOnDate(latestIntentionDate);
			if (outcomes.length === 0 || !outcomes[0].reviewed) {
				return true;
			}
			return false;
		}
		return false;
	};

	const listOutcomesOnDate = async (date: Date) => {
		const outcomes = await trpc().outcomes.list.query({
			startDate: date,
			endDate: date
		});
		return outcomes;
	};

	const handleSaveIntentions = async () => {
		showValidIntentionsNotification = !validIntentions;
		if (!validIntentions) {
			return;
		}

		const orderNumbers = intentions.map((intention) => intention.orderNumber);
		const additionalIntentionsWithoutDuplicates = additionalIntentions.filter(
			(intention) => !orderNumbers.includes(intention.orderNumber)
		);
		intentions = [...intentions, ...additionalIntentionsWithoutDuplicates];

		noIntentions ? await addIntentions() : await updateIntentions();
		todaysIntentionsStore.clear();
	};

	const handleUpdateSingleIntention = async (intention: Intentions) => {
		try {
			const updatedIntention = await trpc().intentions.edit.mutate(intention);
			if (updatedIntention.numUpdatedRows !== undefined && updatedIntention.numUpdatedRows <= 0) {
				showDBErrorNotification = true;
			}
			return updatedIntention;
		} catch (error) {
			appLogger.error('Error updating intention', error);
			showDBErrorNotification = true;
		}
	};

	const handleUpdateIntentions = async () => {
		return await trpc().intentions.updateIntentions.mutate({
			intentions: intentions
		});
	};

	const handleShowAdditionalIntentionsTextArea = () => {
		showAdditionalIntentionsTextArea = true;
	};

	const handleHideAdditionalIntentionsTextArea = () => {
		showValidIntentionsNotification = false;
		additionalIntentions = [];
		showAdditionalIntentionsTextArea = false;
	};
</script>

<svelte:head>
	<title>Someplice - Today's Intentions</title>
</svelte:head>

{#if showPageLoadingSpinner}
	<div class="flex justify-center">
		<span class=" loading  loading-spinner  loading-lg" />
	</div>
{:else}
	<div class="flex flex-col gap-4">
		<GoalBadges goals={data.goals} />
		{#if !(intentionsFromServer.length > 0) && !hasOutstandingOutcome}
			<h2 class="text-xl font-bold">Actions you'll take towards your goals today</h2>
		{/if}
		{#if noGoals}
			<div role="alert" class=" alert  alert-error border-gray-400">
				<CircleX class="h-6 w-6 shrink-0 stroke-current" />
				<span>You have no goals. Please add some goals first.</span>
			</div>
		{:else if hasOutstandingOutcome}
			<Review {intentionsOnLatestDate} {setHasOutstandingOutcome} />
		{:else if intentionsFromServer.length > 0}
			<ActionsDisplay
				bind:intentions={data.intentions}
				{handleUpdateSingleIntention}
				goals={data.goals}
			/>
			{#if showAdditionalIntentionsTextArea}
				<div class="flex items-center">
					<button
						class=" btn mr-2"
						on:click={handleHideAdditionalIntentionsTextArea}>Hide</button
					>
					<h3 class="text-lg font-bold">What else are you doing towards your goals today?</h3>
				</div>
				{#if showValidIntentionsNotification}
					<div role="alert" class=" alert  alert-error border-gray-400">
						<CircleX class="h-6 w-6 shrink-0 stroke-current" />
						<span
							>Please check that your intentions are formatted correctly and have valid goal
							numbers.</span
						>
					</div>
				{/if}
				<ActionsTextInput
					goals={data.goals}
					bind:intentions={additionalIntentions}
					bind:valid={validIntentions}
					existingIntentions={intentionsFromServer}
				/>
				<div>
					<button class=" btn" on:click={handleSaveIntentions}>
						Set {dayOfWeekFromDate(new Date())} intentions
					</button>
				</div>
			{:else}
				<div>
					<button class=" btn" on:click={handleShowAdditionalIntentionsTextArea}>
						Add more {dayOfWeekFromDate(new Date())} intentions
					</button>
				</div>
			{/if}
		{:else}
			{#if showValidIntentionsNotification}
				<div role="alert" class=" alert  alert-error border-gray-400">
					<CircleX class="h-6 w-6 shrink-0 stroke-current" />
					<span
						>Please check that your intentions are formatted correctly and have valid goal
						numbers.</span
					>
				</div>
			{/if}
			<ActionsTextInput goals={data.goals} bind:intentions bind:valid={validIntentions} />

			<div>
				<button class=" btn" on:click={handleSaveIntentions}>
					Set {dayOfWeekFromDate(new Date())} intentions
				</button>
			</div>
		{/if}

		{#if showDBErrorNotification}
			<div class=" toast">
				<div class=" alert  alert-error">
					<span>Error saving intentions</span>
				</div>
			</div>
		{/if}
	</div>
{/if}
