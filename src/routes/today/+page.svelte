<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '$src/lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { localeCurrentDate } from '$src/lib/utils';
	import { Box, Button, Notification, Stack, Title } from '@svelteuidev/core';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';

	export let data: PageServerData;
	type Intentions = (typeof data.intentions)[0];
	$: noGoals = data.goals.length === 0;
	$: noIntentions = data.intentions.length === 0;

	$: intentions = data.intentions;
	$: intentionsFromServer = data.intentions;

	let additionalIntentions: Intentions[] = [];
	// let backupIntentions: Intentions[] = [];

	let validIntentions: boolean;
	let showValidIntentionsNotification = false;
	let showAdditionalIntentionsTextArea = false;
	let showDBErrorNotification = false;
	$: if (showDBErrorNotification) {
		setTimeout(() => {
			showDBErrorNotification = false;
		}, 5000);
	}

	const handleSaveIntentions = async () => {
		showValidIntentionsNotification = !validIntentions;
		if (!validIntentions) {
			return;
		}

		// Hack: Combine additionalIntentions with intentions while removing duplicate orderNumbers
		const orderNumbers = intentions.map((intention) => intention.orderNumber);
		const additionalIntentionsWithoutDuplicates = additionalIntentions.filter(
			(intention) => !orderNumbers.includes(intention.orderNumber)
		);
		intentions = [...intentions, ...additionalIntentionsWithoutDuplicates];
		console.log('🚀 ~ file: +page.svelte:39 ~ handleSaveIntentions ~ intentions:', intentions);

		if (noIntentions) {
			const addResult = await trpc($page).intentions.updateIntentions.mutate({
				intentions: intentions
			});
			if (addResult?.length > 0) {
				await invalidateAll();
			} else {
				showDBErrorNotification = true;
			}
		} else {
			const updateResult = await handleUpdateIntentions();
			if (updateResult?.length > 0) {
				handleHideAdditionalIntentionsTextArea();
				await invalidateAll();
			} else {
				showDBErrorNotification = true;
			}
		}
	};
	const handleUpdateSingleIntention = async (intention: Intentions) => {
		const updatedIntention = await trpc($page).intentions.edit.mutate(intention);
		if (updatedIntention.length <= 0) {
			showDBErrorNotification = true;
		}
		return updatedIntention;
	};
	const handleUpdateIntentions = async () => {
		console.log('🚀 ~ file: +page.svelte:62 ~ handleUpdateIntentions ~ intentions:', intentions);
		return await trpc($page).intentions.updateIntentions.mutate({
			intentions: intentions
		});
	};
	const handleShowAdditionalIntentionsTextArea = () => {
		showAdditionalIntentionsTextArea = true;
	};
	const handleHideAdditionalIntentionsTextArea = () => {
		additionalIntentions = [];
		showAdditionalIntentionsTextArea = false;
	};

	const dayOfWeekFromDate = (date: Date) => {
		const dayOfWeek = date.getDay();
		const daysOfWeek = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday'
		];
		return daysOfWeek[dayOfWeek];
	};
</script>

<Stack>
	<GoalBadges goals={data.goals} />
	<Title order={2} color="white">Actions you'll take towards your goals today</Title>

	{#if noGoals}
		<Notification icon={CircleX} color="red" withCloseButton={false} class="border-gray-400">
			You have no goals. Please add some goals first.
		</Notification>
	{:else if intentionsFromServer.length > 0}
		<ActionsDisplay bind:intentions {handleUpdateSingleIntention} goals={data.goals} />
		{#if showAdditionalIntentionsTextArea}
			<Box class="flex items-center">
				<Button on:click={handleHideAdditionalIntentionsTextArea} class="mr-2">Hide</Button>
				<Title order={3} color="white">What else are you doing towards your goals today?</Title>
			</Box>
			{#if showValidIntentionsNotification}
				<Notification icon={CircleX} color="red" withCloseButton={false} class="border-gray-400">
					Error in intentions. Please check that your intentions are formatted correctly and have
					valid goal numbers.
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
					Set {dayOfWeekFromDate(localeCurrentDate())} intentions
				</Button>
			</Box>
		{:else}
			<Box>
				<Button on:click={handleShowAdditionalIntentionsTextArea}>
					Add more {dayOfWeekFromDate(localeCurrentDate())} intentions
				</Button>
			</Box>
		{/if}
	{:else}
		{#if showValidIntentionsNotification}
			<Notification icon={CircleX} color="red" withCloseButton={false} class="border-gray-400">
				Error in intentions. Please check that your intentions are formatted correctly and have
				valid goal numbers.
			</Notification>
		{/if}
		<ActionsTextInput goals={data.goals} bind:intentions bind:valid={validIntentions} />

		<Box>
			<Button on:click={handleSaveIntentions}>
				Set {dayOfWeekFromDate(localeCurrentDate())} intentions
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
