<script lang="ts">
	import { goalPageErrorStore } from '$src/lib/stores/errors.svelte';
	import X from 'virtual:icons/lucide/x';

	let { children } = $props();
</script>

{#if goalPageErrorStore.current}
	<div class="toast toast-center">
		<div class="alert alert-error flex gap-2">
			<button
				class="btn btn-circle btn-sm"
				aria-label="Dismiss notification"
				onclick={() => goalPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{goalPageErrorStore.current}</p>
		</div>
	</div>
{/if}

{@render children()}
