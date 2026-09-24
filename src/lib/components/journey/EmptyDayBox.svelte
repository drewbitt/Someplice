<script lang="ts">
	let { numDays }: { numDays: number } = $props();
</script>

<div
	role="listitem"
	id="journey-item-empty"
	class="border-base-300 bg-base-100 grid w-full justify-center gap-3 border py-4 shadow-lg"
>
	<h2 class="text-base-content/60 ml-5 text-lg font-bold tabular-nums">
		{numDays} blank days
	</h2>
</div>
