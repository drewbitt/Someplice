<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { evenLighterHSLColor } from '$src/lib/utils';
	import { onMount } from 'svelte';
	import type { PageServerData } from '../../../routes/goals/$types';

	export let goal: PageServerData['goals'][0];
	let startDate = '';
	let endDate = '';

	onMount(async () => {
		if (!goal.id) return;

		const goalLogs = await trpc($page).goal_logs.get.query(goal.id);
		if (goalLogs.length > 0) {
			startDate = goalLogs[0].startDate;
			endDate = goalLogs[0].endDate ?? '';
		}
	});
</script>

<div
	class="goal-box-date-display flex justify-between items-center mx-5 px-1 py-1"
	style="background-color: {evenLighterHSLColor(goal.color)}"
>
	<span class="goal-box-date-display-date">
		Start: {startDate.slice(0, 10)}
	</span>
	<span class="goal-box-date-display-date">
		End: {endDate.slice(0, 10)}
	</span>
</div>
