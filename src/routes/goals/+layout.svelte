<script lang="ts">
	import { goalPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $goalPageErrorStore}
	<div class=" toast  toast-center">
		<div class=" alert  alert-error flex gap-2">
			<button
				class=" btn  btn-circle  btn-sm"
				on:click={() => goalPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$goalPageErrorStore}</p>
		</div>
	</div>
{/if}

<slot />
