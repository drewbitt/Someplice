<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '$src/lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import Review from '$src/lib/components/today/review-outcomes/Review.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { dayOfWeekFromDate } from '$src/lib/utils';
	import { Box, Button, Notification, Stack, Title } from '@svelteuidev/core';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';

	export let data: PageServerData;
	type Intentions = (typeof data.intentions)[0];

	// let declarations grouped together
	let intentions = data.intentions;
	let latestIntentions = data.latestIntentions;
	let additionalIntentions: Intentions[] = [];
	let validIntentions: boolean;
	let showValidIntentionsNotification = false;
	let showAdditionalIntentionsTextArea = false;
	let showDBErrorNotification = false;
	let intentionsFromServer: Intentions[] = data.intentions;
	let hasOutstandingOutcome = false;
	let showPageLoadingSpinner = false;

	// $: declarations grouped together
	$: noGoals = data.goals.length === 0;
	$: noIntentions = data.intentions.length === 0;
	$: if (showDBErrorNotification) {
		setTimeout(() => {
			showDBErrorNotification = false;
		}, 5000);
	}
	// if no intentions today, check for old outstanding outcomes
	$: if (noIntentions && !noGoals) {
		isOldOutcomeOutstanding().then((result) => {
			if (result) {
				// if there is an outstanding outcome
				hasOutstandingOutcome = true;
				showPageLoadingSpinner = false;
			}
		});
	}
	// show loading spinner if noIntentions is true and we are waiting for the outcome check
	$: if (noIntentions && !hasOutstandingOutcome && !noGoals) {
		showPageLoadingSpinner = true;
	}

	const addIntentions = async () => {
		const addResult = await trpc($page).intentions.updateIntentions.mutate({
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

	/**
		Check if the latest intentions have an outcome reviewed on the same day
	*/
	const isOldOutcomeOutstanding = async () => {
		const latestIntentionDate = new Date(latestIntentions[0].date);
		const outcomes = await listOutcomesOnDate(latestIntentionDate);
		// if there are no outcomes on the same day as the latest intentions, or if it is reviewed = false
		if (outcomes.length === 0 || !outcomes[0].reviewed) {
			return true;
		}
		return false;
	};

	const listOutcomesOnDate = async (date: Date) => {
		const outcomes = await trpc($page).outcomes.list.query(date);
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

		noIntentions ? addIntentions() : updateIntentions();
	};

	const handleUpdateSingleIntention = async (intention: Intentions) => {
		const updatedIntention = await trpc($page).intentions.edit.mutate(intention);
		if (
			updatedIntention[0]?.numUpdatedRows !== undefined &&
			updatedIntention[0].numUpdatedRows <= 0
		) {
			showDBErrorNotification = true;
		}
		return updatedIntention;
	};

	const handleUpdateIntentions = async () => {
		return await trpc($page).intentions.updateIntentions.mutate({
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
	<title>Today's Intentions</title>
</svelte:head>

{#if showPageLoadingSpinner}
	<div class="flex justify-center">
		<span class="daisy-loading daisy-loading-spinner daisy-loading-lg" />
	</div>
{:else}
	<Stack>
		<GoalBadges goals={data.goals} />
		{#if !(intentionsFromServer.length > 0) && !hasOutstandingOutcome}
			<Title order={2}>Actions you'll take towards your goals today</Title>
		{/if}
		{#if noGoals}
			<Notification
				id="no-goals-notification"
				icon={CircleX}
				color="red"
				withCloseButton={false}
				class="border-gray-400"
			>
				You have no goals. Please add some goals first.
			</Notification>
			<!-- if there are no intentions set today -->
		{:else if hasOutstandingOutcome}
			<Review {latestIntentions} />
			<!-- if there are intentions already set today -->
		{:else if intentionsFromServer.length > 0}
			<ActionsDisplay
				bind:intentions={data.intentions}
				{handleUpdateSingleIntention}
				goals={data.goals}
			/>
			<!-- if user presses "Add more intentions" button -->
			{#if showAdditionalIntentionsTextArea}
				<Box class="flex items-center">
					<Button on:click={handleHideAdditionalIntentionsTextArea} class="mr-2">Hide</Button>
					<Title order={3}>What else are you doing towards your goals today?</Title>
				</Box>
				{#if showValidIntentionsNotification}
					<Notification icon={CircleX} color="red" withCloseButton={false} class="border-gray-400">
						Please check that your intentions are formatted correctly and have valid goal numbers.
					</Notification>
				{/if}
				<ActionsTextInput
					goals={data.goals}
					bind:intentions={additionalIntentions}
					bind:valid={validIntentions}
					existingIntentions={intentionsFromServer}
				/>
				<Box>
					<Button on:click={handleSaveIntentions}>
						Set {dayOfWeekFromDate(new Date())} intentions
					</Button>
				</Box>
				<!-- if user hasn't pressed "Add more intentions" button, display the button -->
			{:else}
				<Box>
					<Button on:click={handleShowAdditionalIntentionsTextArea}>
						Add more {dayOfWeekFromDate(new Date())} intentions
					</Button>
				</Box>
			{/if}
		{:else}
			{#if showValidIntentionsNotification}
				<Notification icon={CircleX} color="red" withCloseButton={false} class="border-gray-400">
					Please check that your intentions are formatted correctly and have valid goal numbers.
				</Notification>
			{/if}
			<ActionsTextInput goals={data.goals} bind:intentions bind:valid={validIntentions} />

			<Box>
				<Button on:click={handleSaveIntentions}>
					Set {dayOfWeekFromDate(new Date())} intentions
				</Button>
			</Box>
		{/if}

		{#if showDBErrorNotification}
			<div class="daisy-toast">
				<div class="daisy-alert daisy-alert-error">
					<div>
						<span>Error saving intentions</span>
					</div>
				</div>
			</div>
		{/if}
	</Stack>
{/if}
