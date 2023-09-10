<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import type { PageServerData } from './[page]/$types';
	export let data: PageServerData;
	import { Title, colorScheme, createStyles } from '@svelteuidev/core';

	// let declarations grouped together
	let goals = data.goals;
	let intentionsByDate = data.intentionsByDate;
	let outcomes = data.outcomes;

	$: darkMode = $colorScheme === 'dark';
</script>

<svelte:head>
	<title>Someplice - Journey</title>
</svelte:head>

<div class="w-full pb-3 shadow-md">
	<div class="mx-12 grid gap-4">
		<Title order={1} class="font-bold">My daily progress</Title>
		<GoalBadges {goals} />
	</div>
</div>

<section class={darkMode ? 'bg-gray-900' : 'bg-gray-200'}>
	<div class="mx-12 grid gap-4 py-6">
		{#each Object.entries(intentionsByDate) as [ intentions]}
			<JourneyDayBox {intentions} {goals} {outcomes} />
		{/each}
	</div>
</section>
