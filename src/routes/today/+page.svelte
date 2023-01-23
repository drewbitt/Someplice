<script lang="ts">
	import ActionsTextInput from '$lib/components/today/ActionsTextInput.svelte';
	import { Box, Button, Title } from '@svelteuidev/core';
	import type { PageServerData } from './$types';

	export let data: PageServerData;

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

<Title order={2} color="white">Actions you'll take towards your goals today</Title>

<ActionsTextInput goals={data.goals} />

<Box>
	<Button>
		Set {dayOfWeekFromDate(new Date())} intentions
	</Button>
</Box>
