<script lang="ts">
	import { Paper, Stack } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/today/$types';

	export let goals: PageServerData['goals'];
	export let intentions: PageServerData['intentions'];
	type Intention = (typeof intentions)[0];
	export let handleUpdateSingleIntention: (intentions: Intention) => Promise<any>;

	const goalOrderNumberForId = (goalId: number) => {
		const goal = goals.find((goal) => goal.id === goalId);
		if (goal) {
			return goal.orderNumber;
		}
		return -1;
	};

	// filter intentions to make sure no errors are present (e.g. no goal id)
	$: intentions = intentions.filter(
		(intention) => intention.goalId !== -1 && intention !== undefined && intention.goalId !== null
	);

	const updateIntention = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		const intentionId = target.dataset.id;
		if (intentionId) {
			let intention = intentions.find((intention) => {
				return intention.id === parseInt(intentionId);
			});
			if (intention) {
				intention = { ...intention, completed: target.checked ? 1 : 0 };
				const updatedIntention = await handleUpdateSingleIntention(intention);
				if (updatedIntention.length > 0) {
					intentions = intentions.map((intention) => {
						if (intention.id === parseInt(intentionId)) {
							intention.completed = target.checked ? 1 : 0;
						}
						return intention;
					});
				}
			}
		}
	};

	const goalColorForIntention = (intention: Intention) => {
		const goal = goals.find((goal) => goal.id === intention.goalId);
		if (goal) {
			return goal.color;
		}
		return 'black';
	};
</script>

<Paper shadow="sm">
	<Stack class="gap-1.5">
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
					>{goalOrderNumberForId(intention.goalId)}) {intention.text}</span
				>
			</div>
		{/each}
	</Stack>
</Paper>
