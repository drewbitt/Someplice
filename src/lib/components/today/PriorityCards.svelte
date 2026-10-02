<script lang="ts">
	import type { Goal, Priority } from '$src/lib/trpc/types';
	import { todayPageErrorStore } from '$src/lib/stores/errors.svelte';
	import PriorityModal from '../shared/PriorityModal.svelte';

	let {
		goals,
		priorities
	}: {
		goals: Goal[];
		priorities: Priority[];
	} = $props();

	let showModal = $state(false);
	let selectedGoal = $state<Goal | null>(null);
	let selectedPriority = $state<Priority | null>(null);

	const priorityForGoal = (goalId: number | null) =>
		priorities.find((priority) => priority.goalId === goalId) ?? null;

	const openModal = (goal: Goal) => {
		selectedGoal = goal;
		selectedPriority = priorityForGoal(goal.id);
		showModal = true;
	};
</script>

<div class="flex flex-wrap gap-2" aria-label="Top priorities">
	{#each goals as goal (goal.id)}
		{@const priority = priorityForGoal(goal.id)}
		<button
			class="priority-card goal-text flex items-center gap-1 rounded-md border-2 px-3 py-1.5 font-semibold"
			style="--goal-color: {goal.color}; border-color: currentcolor"
			onclick={() => openModal(goal)}
		>
			<span class="font-mono text-xl">{goal.orderNumber}</span>
			<span>:</span>
			{#if priority}
				<span class="max-w-60 truncate">{priority.text}</span>
			{:else}
				<span aria-label="Set top priority for goal {goal.orderNumber}">+</span>
			{/if}
		</button>
	{/each}
</div>

{#if selectedGoal}
	<PriorityModal
		bind:showModal
		goal={selectedGoal}
		priority={selectedPriority}
		onError={(message) => todayPageErrorStore.setError(message)}
	/>
{/if}
