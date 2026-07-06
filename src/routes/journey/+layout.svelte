<script lang="ts">
	import { journeyPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';

	let { children } = $props();
</script>

{#if $journeyPageErrorStore}
	<div class="toast toast-center">
		<div class="alert alert-error flex gap-2">
			<button
				class="btn btn-circle btn-sm"
				onclick={() => journeyPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$journeyPageErrorStore}</p>
		</div>
	</div>
{/if}

{@render children()}
