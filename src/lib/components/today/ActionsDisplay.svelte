<script lang="ts">
	import { Paper } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/today/$types';

	export let intentions: PageServerData['intentions'];
	export let handleUpdateIntentions: (intentions: PageServerData['intentions']) => void;

	const updateIntention = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const intentionId = target.dataset.id;
		if (intentionId) {
			const intention = intentions.find((intention) => {
				return intention.id === parseInt(intentionId);
			});
			if (intention) {
				// Slightly inefficient, but updating in-place doesn't work in Svelte to re-render
				intentions = intentions.map((intention) => {
					if (intention.id === parseInt(intentionId)) {
						intention.completed = target.checked ? 1 : 0;
					}
					return intention;
				});
				handleUpdateIntentions(intentions);
			}
		}
	};
</script>

<Paper shadow="sm">
	{#each intentions as intention}
		<div class={'flex items-center' + (Boolean(intention.completed) ? ' line-through' : '')}>
			<input
				data-id={intention.id}
				type="checkbox"
				class="form-checkbox"
				checked={Boolean(intention.completed)}
				on:change={updateIntention}
			/>
			<span class="ml-2">{intention.text}</span>
		</div>
	{/each}
</Paper>
