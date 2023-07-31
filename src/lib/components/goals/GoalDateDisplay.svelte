<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { evenLighterHSLColor } from '$src/lib/utils';
	import { logger } from '$src/lib/utils/logger';
	import { Box } from '@svelteuidev/core';
	import { onMount } from 'svelte';
	import type { PageServerData } from '../../../routes/goals/$types';

	export let goal: PageServerData['goals'][0];
	let startDate = '';
	let endDate = '';

	onMount(async () => {
		if (!goal.id) return;

		try {
			const goalLogs = await trpc($page).goal_logs.getAllForGoal.query(goal.id);
			if (goalLogs.length > 0) {
				// filter 'start' and 'end' dates and sort them in descending order
				const startDates = goalLogs
					.filter((log) => log.type === 'start')
					.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				const endDates = goalLogs
					.filter((log) => log.type === 'end')
					.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				startDate = startDates[0]?.date ?? '';
				endDate = endDates[0]?.date ?? '';
			}
		} catch (error) {
			// TODO: handle error
			logger.error(error);
		}
	});
</script>

<Box
	class="goal-box-date-display mx-5 flex items-center justify-between px-1 py-1"
	style="background-color: {evenLighterHSLColor(goal.color)}"
>
	<span class="goal-box-date-display-date">
		Start: {startDate.slice(0, 10)}
	</span>
	<span class="goal-box-date-display-date">
		End: {endDate.slice(0, 10)}
	</span>
</Box>
