<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention } from '$src/lib/utils';

	let { goals, intentions }: { goals: Goal[]; intentions: Intention[] } = $props();

	let numIntentions = $derived(intentions.length);
</script>

<div class="my-5 ml-5" aria-label="List of Intentions for the day">
	<h3 class="mb-3 text-xl font-bold">
		{numIntentions}
		{numIntentions === 1 ? 'intention' : 'intentions'}
	</h3>
	<div>
		{#each intentions as intention (intention.id)}
			<div class="flex">
				<span style="color: {goalColorForIntention(intention, goals)}" class="me-1 text-lg">
					{intention.orderNumber}) {intention.text}
				</span>
			</div>
		{/each}
	</div>
</div>
