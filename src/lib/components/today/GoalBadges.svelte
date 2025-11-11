<script lang="ts">
	import { Badge, Group } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/today/$types';

	export let goals: PageServerData['goals'];
</script>

<Group>
	{#each goals as goal (goal.id)}
		<Badge size="lg" variant="filled" color={goal.color} class="border border-gray-200 px-4">
			{goal.title}
			<svelte:fragment slot="leftSection">
				<span class="pr-1 font-mono text-xl">
					{goal.orderNumber}
				</span>
			</svelte:fragment>
		</Badge>
	{/each}
</Group>
