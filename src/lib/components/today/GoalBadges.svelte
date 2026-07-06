<script lang="ts">
	import type { PageServerData } from '../../../routes/today/$types';

	let { goals }: { goals: PageServerData['goals'] } = $props();
</script>

<div class="flex items-center gap-2">
	{#each goals as goal (goal.id)}
		<span class="badge border border-gray-200 px-4" style="background-color: {goal.color}; color: white">
			<span class="pr-1 font-mono text-xl">
				{goal.orderNumber}
			</span>
			{goal.title}
		</span>
	{/each}
</div>
