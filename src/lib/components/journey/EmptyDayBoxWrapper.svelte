<script lang="ts">
	import { onMount } from 'svelte';
	import EmptyDayBox from './EmptyDayBox.svelte';

	let { date, nextDate }: { date: string; nextDate: string } = $props();

	let diffDays = $state(0);

	onMount(() => {
		let dateObj = new Date(date);
		let nextDateObj = new Date(nextDate);
		if (dateObj < nextDateObj) return;
		diffDays = Math.ceil((dateObj.getTime() - nextDateObj.getTime()) / (1000 * 60 * 60 * 24)) - 1;
	});
</script>

{#if diffDays > 0}
	<EmptyDayBox numDays={diffDays} />
{/if}
