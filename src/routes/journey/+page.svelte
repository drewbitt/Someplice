<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import { Title, colorScheme } from '@svelteuidev/core';
	import type { PageServerData } from './$types';
	import EmptyDayBoxWrapper from '$src/lib/components/journey/EmptyDayBoxWrapper.svelte';

	export let data: PageServerData;

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
