<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import ActionsTextInput from '#lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '#lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '#lib/components/today/GoalBadges.svelte';
	import PriorityCards from '#lib/components/today/PriorityCards.svelte';
	import Review from '#lib/components/today/review-outcomes/Review.svelte';
	import { trpc } from '#lib/trpc/client.js';
	import { dayOfWeekInZone, goalsForJourneyDay } from '#lib/utils/index.js';
	import { appTimeZone } from '#lib/stores/timezone.svelte.js';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import { todaysIntentions } from '#lib/stores/todaysIntentions.js';
	import { onMount } from 'svelte';
	import { appLogger } from '#lib/utils/logger.js';

	let { data }: { data: PageServerData } = $props();
	type Intentions = (typeof data.intentions)[0];

	// svelte-ignore state_referenced_locally
	let intentions = $state(data.intentions);
	// svelte-ignore state_referenced_locally
	let intentionsOnLatestDate = $state(data.intentionsOnLatestDate);
	let additionalIntentions = $state<Intentions[]>([]);
	let validIntentions = $state<boolean>(false);
	let showValidIntentionsNotification = $state(false);
	let showAdditionalIntentionsTextArea = $state(false);
	let showDBErrorNotification = $state(false);
	// svelte-ignore state_referenced_locally
	let intentionsFromServer = $state(data.intentions);
	let hasOutstandingOutcome = $state(false);
	let saving = $state(false);

	$effect(() => {
		intentions = data.intentions;
		intentionsOnLatestDate = data.intentionsOnLatestDate;
		intentionsFromServer = data.intentions;
		hasOutstandingOutcome = data.hasOutstandingOutcome;
	});

	onMount(() => {
		if (todaysIntentions.current && !noGoals && !noIntentions) {
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

	const setHasOutstandingOutcome = (value: boolean) => {
		hasOutstandingOutcome = value;
	};

	const handleSaveIntentions = async () => {
		showValidIntentionsNotification = !validIntentions;
		if (!validIntentions || saving) return;
		// Keep drafts separate until the write succeeds, so retries use the current editor.
		const payload = noIntentions ? intentions : additionalIntentions;
		saving = true;
		try {
			if (payload.length > 0) {
				await trpc().intentions.updateIntentions.mutate({ intentions: payload });
			}
			todaysIntentions.current = null;
			handleHideAdditionalIntentionsTextArea();
			await refreshAll();
		} catch (error) {
			appLogger.error('Error saving intentions', error);
			showDBErrorNotification = true;
		} finally {
			saving = false;
		}
	};

	const handleUpdateSingleIntention = async (intention: Intentions) => {
		if (intention.id === null) return;
		try {
			const updatedIntention = await trpc().intentions.setStatus.mutate({
				ids: [intention.id],
				status: intention.status
			});
			if (updatedIntention.numUpdatedRows !== undefined && updatedIntention.numUpdatedRows <= 0) {
				showDBErrorNotification = true;
			}
			return updatedIntention;
		} catch (error) {
			appLogger.error('Error updating intention', error);
			showDBErrorNotification = true;
		}
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

<div class="flex flex-col gap-4">
	<GoalBadges goals={data.goals} />
	{#if !noGoals && !hasOutstandingOutcome}
		<PriorityCards goals={data.goals} priorities={data.priorities} />
	{/if}
	{#if !(intentionsFromServer.length > 0) && !hasOutstandingOutcome}
		<h2 class="text-xl font-bold">Actions you'll take towards your goals today</h2>
	{/if}
	{#if hasOutstandingOutcome}
		<Review {intentionsOnLatestDate} {setHasOutstandingOutcome} />
	{:else if noGoals && noIntentions}
		<div role="alert" class="alert alert-error border-error">
			<CircleX class="size-6 shrink-0 stroke-current" />
			<span>You have no goals. Please add some goals first.</span>
		</div>
	{:else if intentionsFromServer.length > 0}
		<ActionsDisplay
			bind:intentions
			{handleUpdateSingleIntention}
			goals={goalsForJourneyDay(data.goals, data.inactiveGoals, intentions)}
		/>
		{#if showAdditionalIntentionsTextArea}
			<div class="flex items-center">
				<button class="btn mr-2" onclick={handleHideAdditionalIntentionsTextArea}>Hide</button>
				<h3 class="text-lg font-bold">What else are you doing towards your goals today?</h3>
			</div>
			{#if showValidIntentionsNotification}
				<div role="alert" class="alert alert-error border-error">
					<CircleX class="size-6 shrink-0 stroke-current" />
					<span
						>Please check that your intentions are formatted correctly and have valid goal numbers.</span
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
				<button class="btn" disabled={saving} onclick={handleSaveIntentions}>
					Set {dayOfWeekInZone(appTimeZone.current)} intentions
				</button>
			</div>
		{:else}
			<div>
				<button class="btn" onclick={handleShowAdditionalIntentionsTextArea}>
					Add more {dayOfWeekInZone(appTimeZone.current)} intentions
				</button>
			</div>
		{/if}
	{:else}
		{#if showValidIntentionsNotification}
			<div role="alert" class="alert alert-error border-error">
				<CircleX class="size-6 shrink-0 stroke-current" />
				<span
					>Please check that your intentions are formatted correctly and have valid goal numbers.</span
				>
			</div>
		{/if}
		<ActionsTextInput goals={data.goals} bind:intentions bind:valid={validIntentions} />

		<div>
			<button class="btn" disabled={saving} onclick={handleSaveIntentions}>
				Set {dayOfWeekInZone(appTimeZone.current)} intentions
			</button>
		</div>
	{/if}

	{#if showDBErrorNotification}
		<div class="toast">
			<div class="alert alert-error">
				<span>Error saving intentions</span>
			</div>
		</div>
	{/if}
</div>
