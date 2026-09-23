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
	<h4
		class="ml-5 text-lg font-bold"
		class:text-gray-500={theme.current === 'dark'}
		class:text-gray-400={theme.current !== 'dark'}
	>
		{numDays} blank days
	</h4>
</div>
