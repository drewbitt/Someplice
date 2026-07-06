<script lang="ts">
	import { todayPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $todayPageErrorStore}
	<div class=" toast  toast-center">
		<div class=" alert  alert-error flex gap-2">
			<button
				class=" btn  btn-circle  btn-sm"
				on:click={() => todayPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$todayPageErrorStore}</p>
		</div>
	</div>
{/if}

<slot />
