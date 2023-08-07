<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { evenEvenLighterHSLColor } from '$src/lib/utils';

	export let goal: Goal;
	export let intentions: Intention[];

	const lighterGoalColor = (color: string) => {
		return evenEvenLighterHSLColor(color);
	};
</script>

<div
	role="listitem"
	id="goal-review-item"
	class="flex flex-col items-center w-full max-w-screen-2xl"
>
	<div class="flex flex-col w-4/5 min-w-min goal-review-item-content">
		<div id="goal-review-item-info">
			<span class="flex">
				<span
					style="background-color: {lighterGoalColor(goal.color)}; color: {goal.color}"
					class="font-mono text-2xl px-1.5 font-bold leading-none"
				>
					{goal.orderNumber}
				</span>
				<span
					style="background-color: {goal.color}; font-size: 1.1rem;"
					class="text-white px-1.5 tracking-wider font-semibold leading-6"
				>
					{goal.title}
				</span>
			</span>
		</div>
		<div class="border-2 p-1.5 grid gap-2 max-w-full" style="border-color: {goal.color}">
			{#if goal.description}
				<p class="text-gray-500 font-mono text-lg pl-5 tracking-wide">{goal.description}</p>
			{/if}
			{#if intentions.length && intentions[0].goalId === goal.id}
				{#each intentions as intention}
					<div class="flex">
						<input
							type="checkbox"
							id="intention-{intention.id}"
							value={intention.id}
							checked={Boolean(intention.completed)}
							class="mr-2 daisy-checkbox-md"
						/>
						<label for="intention-{intention.id}" class="text-lg leading-6">{intention.text}</label>
					</div>
				{/each}
			{:else}
				<p class="text-gray-500">No intentions for this goal occurred</p>
			{/if}
		</div>
	</div>
</div>
