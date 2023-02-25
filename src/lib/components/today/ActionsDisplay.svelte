<script lang="ts">
	import { Paper } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/today/$types';

	export let goals: PageServerData['goals'];
	export let intentions: PageServerData['intentions'];
	type Intention = (typeof intentions)[0];
	export let handleUpdateIntentions: (intentions: Intention[]) => Promise<any[]>;
	// filter intentions to make sure no errors are present (e.g. no goal id)
	$: intentions = intentions.filter(
		(intention) => intention.goalId !== -1 && intention !== undefined && intention.goalId !== null
	);

	const updateIntention = async (event: Event) => {
		console.log('Updating intention...');
		const target = event.target as HTMLInputElement;
		const intentionId = target.dataset.id;
		if (intentionId) {
			const intention = intentions.find((intention) => {
				return intention.id === parseInt(intentionId);
			});
			if (intention) {
				intentions = intentions.map((intention) => {
					if (intention.id === parseInt(intentionId)) {
						intention.completed = target.checked ? 1 : 0;
					}
					return intention;
				});
				await handleUpdateIntentions(intentions);
			}
		}
	};
	const goalColorForIntention = (intention: Intention) => {
		const goal = goals.find((goal) => goal.orderNumber === intention.goalId);
		if (goal) {
			return goal.color;
		}
		return 'black';
	};
</script>

<Paper shadow="sm">
	{#each intentions as intention}
		<div class={'flex items-center' + (Boolean(intention.completed) ? ' line-through' : '')}>
			<input
				data-id={intention.id}
				type="checkbox"
				class="daisy-checkbox-xs"
				checked={Boolean(intention.completed)}
				on:change={updateIntention}
			/>
			<span class="ml-2 font-bold" style="color: {goalColorForIntention(intention)}"
				>{intention.goalId}) {intention.text}</span
			>
		</div>
	{/each}
</Paper>
