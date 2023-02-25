<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '$src/lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { Box, Button, Notification, Stack, Title } from '@svelteuidev/core';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';

	export let data: PageServerData;
	type Intentions = (typeof data.intentions)[0];
	$: noGoals = data.goals.length === 0;
	$: noIntentions = data.intentions.length === 0;

	let intentions: Intentions[] = data.intentions;
	let intentionsFromServer: Intentions[] = data.intentions;
	// let backupIntentions: Intentions[] = [];

	let validIntentions: boolean;
	let showValidIntentionsNotification = false;

	const handleSaveIntentions = async () => {
		showValidIntentionsNotification = !validIntentions;
		if (!validIntentions) {
			return;
		}

		if (noIntentions) {
			// If no intentions, use add function
			const addResult = await trpc($page).intentions.add.mutate(intentions);
			if (addResult.length > 0) {
				await invalidateAll();
				intentionsFromServer = intentions;
			}
		} else {
			// If intentions exist, use update function
			await handleUpdateIntentions();
		}
	};

	const handleUpdateIntentions = async () => {
		console.log('🚀 ~ file: +page.svelte:48 ~ awaittrpc ~ intentions:', intentions);
		await trpc($page).intentions.updateIntentions.mutate({
			intentions: intentions
		});
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
		<ActionsDisplay bind:intentions {handleUpdateIntentions} />
		<Box>
			<Button on:click={handleSaveIntentions}>
				Add more {dayOfWeekFromDate(new Date())} intentions
			</Button>
		</Box>
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
				Set {dayOfWeekFromDate(new Date())} intentions
			</Button>
		</Box>
	{/if}
</Stack>
