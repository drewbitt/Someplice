<script lang="ts">
	import type { Goal } from '$src/lib/trpc/types';

	export let goal: Goal;
</script>

<div role="listitem" class="mb-5">
	<div class="border-2" style="border-color: {goal.color}">test</div>
</div>
