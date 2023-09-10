<script lang="ts">
	import { journeyPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $journeyPageErrorStore}
	<div class="daisy-toast daisy-toast-center">
		<div class="daisy-alert daisy-alert-error flex gap-2">
			<button
				class="daisy-btn daisy-btn-circle daisy-btn-sm"
				on:click={() => journeyPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$journeyPageErrorStore}</p>
		</div>
	</div>
{/if}

<slot />
