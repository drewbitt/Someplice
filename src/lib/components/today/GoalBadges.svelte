<script lang="ts">
	import type { PageServerData } from '../../../routes/today/$types';

	let { goals }: { goals: PageServerData['goals'] } = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
	{#each goals as goal (goal.id)}
		<span
			class="badge border-base-300 border px-4 text-white"
			style="background-color: {goal.color}"
		>
			<span class="pr-1 font-mono text-xl">
				{goal.orderNumber}
			</span>
			{goal.title}
		</span>
	{/each}
</div>
