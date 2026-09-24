<script lang="ts">
	import theme from '$lib/stores/theme';

	let { numDays }: { numDays: number } = $props();
</script>

<div
	role="listitem"
	id="journey-item-empty"
	class="grid w-full flex-col justify-center gap-3 border border-gray-300 py-4 shadow-lg"
	class:bg-gray-950={theme.current === 'dark'}
	class:bg-white={theme.current !== 'dark'}
>
	<h2 class="ml-5 text-lg font-bold text-gray-500">
		{numDays} blank days
	</h2>
</div>
