<script lang="ts">
	import { todayPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';

	let { children } = $props();
</script>

{#if $todayPageErrorStore}
	<div class="toast toast-center">
		<div class="alert alert-error flex gap-2">
			<button
				class="btn btn-circle btn-sm"
				onclick={() => todayPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$todayPageErrorStore}</p>
		</div>
	</div>
{/if}

{@render children()}
