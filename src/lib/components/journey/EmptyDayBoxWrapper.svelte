<script lang="ts">
	import { onMount } from 'svelte';
	import EmptyDayBox from './EmptyDayBox.svelte';

	export let date: string;
	export let nextDate: string;

	// Enforce that nextDate is always earlier than date
	if (new Date(date) < new Date(nextDate)) {
		throw new Error('nextDate must be earlier than date');
	}

	let diffDays: number;

	onMount(() => {
		let dateObj = new Date(date);
		let nextDateObj = new Date(nextDate);
		// Calculation for diffDays assuming the nextDate is always earlier than date
		diffDays = Math.ceil((dateObj.getTime() - nextDateObj.getTime()) / (1000 * 60 * 60 * 24)) - 1;
	});
</script>

{#if diffDays > 0}
	<EmptyDayBox numDays={diffDays} />
{/if}
