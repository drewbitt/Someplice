<script lang="ts">
	import JourneyDayBox from '$src/lib/components/journey/JourneyDayBox.svelte';
	import GoalBadges from '$src/lib/components/today/GoalBadges.svelte';
	import type { PageServerData } from './$types';
	export let data: PageServerData;
	import { Title, colorScheme, createStyles } from '@svelteuidev/core';

	// let declarations grouped together
	let goals = data.goals;
	let intentionsByDate = data.intentionsByDate;
	let outcomes = data.outcomes;
	// console.log(
	// 	'%c [ intentionsByDate ]-8',
	// 	'font-size:13px; background:pink; color:#bf2c9f;',
	// 	intentionsByDate
	// );

	const useStyles = createStyles(() => ({
		root: {
			darkMode: {
				color: 'black'
			}
		}
	}));
	$: darkMode = $colorScheme === 'dark';
	$: ({ cx, getStyles } = useStyles());
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

<section class={cx(darkMode ? 'bg-gray-900' : 'bg-gray-200')}>
	<div class="mx-12 grid gap-4 py-6">
		{#each Object.entries(intentionsByDate) as [date, intentions]}
			<JourneyDayBox {intentions} {date} {goals} {outcomes} />
		{/each}
	</div>
</section>
