<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { Notification, Title, colorScheme } from '@svelteuidev/core';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '$src/lib/components/journey/EmptyDayBoxWrapper.svelte';

	export let data: PageServerData;
	$: noIntentions = Object.keys(data.intentionsByDate).length === 0;
	$: noGoals = data.goals.length === 0;

	$: darkMode = $colorScheme === 'dark';
	let dates = Object.keys(data.intentionsByDate);
</script>

<svelte:head>
	<title>Someplice - Journey</title>
</svelte:head>

<div class="w-full pb-3 shadow-md">
	<div class="mx-12 grid gap-4">
		<Title order={1} class="font-bold">My daily progress</Title>
		<GoalBadges goals={data.goals} />
	</div>
</div>

{#if noGoals || noIntentions}
	<Notification
		id="no-goals-notification"
		icon={CircleX}
		color="red"
		withCloseButton={false}
		class="border-gray-400"
	>
		Begin your Journey by adding goals and intentions.
	</Notification>
{:else}
	<section class={darkMode ? 'bg-gray-900' : 'bg-gray-200'}>
		<div class="mx-12 grid gap-4 py-6">
			{#each dates as date, i (date)}
				<JourneyDayBox
					goals={data.goals}
					intentions={data.intentionsByDate[date]}
					outcomes={data.outcomes}
				/>
				{#if i < dates.length - 1}
					<EmptyDayBoxWrapper {date} nextDate={dates[i + 1]} />
				{/if}
			{/each}
		</div>
	</section>
{/if}