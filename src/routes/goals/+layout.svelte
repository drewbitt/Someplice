<script lang="ts">
	import { goalPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $goalPageErrorStore}
	<div class="daisy-toast daisy-toast-center">
		<div class="daisy-alert daisy-alert-error flex gap-2">
			<button
				class="daisy-btn daisy-btn-circle daisy-btn-sm"
				on:click={() => goalPageErrorStore.set(null)}
			>
				<X />
			</button>
			<p>{$goalPageErrorStore}</p>
		</div>
	</div>
{/if}

<slot />
