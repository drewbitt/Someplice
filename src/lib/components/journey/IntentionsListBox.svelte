<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention } from '$src/lib/utils';
	import { Title } from '@svelteuidev/core';

	export let goals: Goal[];
	export let intentions: Intention[];

	$: numIntentions = intentions.length;
</script>

<div class="my-5 ml-5" aria-label="List of Intentions for the day">
	<Title order={3} class="mb-3 font-bold">
		{numIntentions}
		{numIntentions === 1 ? 'intention' : 'intentions'}
	</Title>
	<div>
		{#each intentions as intention}
			<div class="flex">
				<span style="color: {goalColorForIntention(intention, goals)}" class="me-1 text-lg">
					{intention.orderNumber}) {intention.text}
				</span>
			</div>
		{/each}
	</div>
</div>
