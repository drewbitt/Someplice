<script lang="ts">
	import { todayPageErrorStore } from '$src/lib/stores/errors.svelte';
	import X from 'virtual:icons/lucide/x';

	let { children } = $props();
</script>

{#if todayPageErrorStore.current}
	<div class="toast toast-center">
		<div class="alert alert-error flex gap-2">
			<button
				class="btn btn-circle btn-sm"
				aria-label="Dismiss notification"
				onclick={() => todayPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{todayPageErrorStore.current}</p>
		</div>
	</div>
{/if}

{@render children()}
