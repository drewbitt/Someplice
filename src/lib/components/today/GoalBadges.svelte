<script lang="ts">
	import { Badge, Group } from '@svelteuidev/core';
	import type { PageServerData } from './$types';

	export let goals: PageServerData['goals'];
</script>

<Group>
	{#each goals as goal}
		<Badge size="lg" variant="filled" color={goal.color}>
			{goal.title}
			<svelte:fragment slot="leftSection">
				<span class="pr-1">
					{goal.orderNumber}
				</span>
			</svelte:fragment>
		</Badge>
	{/each}
</Group>
