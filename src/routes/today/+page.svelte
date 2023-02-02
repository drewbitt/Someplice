<script lang="ts">
	import { page } from '$app/stores';
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import { Box, Button, Notification, Stack, Title } from '@svelteuidev/core';
	import CircleX from '~icons/lucide/x-circle';
	import type { PageServerData } from './$types';

	export let data: PageServerData;
	type Intentions = (typeof data.intentions)[0];
	$: noGoals = data.goals.length === 0;
	$: noIntentions = data.intentions.length === 0;

	let intentions: Intentions[] = data.intentions;
	let backupIntentions: Intentions[] = [];

	const handleSaveIntentions = () => {
		if (noIntentions) {
			console.log('🚀 ~ file: +page.svelte:16 ~ intentions', intentions);
			trpc($page).intentions.add.mutate(intentions);
		} else {
		}
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
	{:else}
		<ActionsTextInput goals={data.goals} bind:intentions />

		<Box>
			<Button on:click={handleSaveIntentions}>
				Set {dayOfWeekFromDate(new Date())} intentions
			</Button>
		</Box>
	{/if}
</Stack>
