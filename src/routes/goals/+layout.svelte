<script lang="ts">
	import { goalPageError } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $goalPageError}
	<div class="daisy-toast daisy-toast-center">
		<div class="daisy-alert daisy-alert-error flex gap-2">
			<button
				class="daisy-btn daisy-btn-circle daisy-btn-sm"
				on:click={() => goalPageError.set(null)}
			>
				<X />
			</button>
			<p>{$goalPageError}</p>
		</div>
	</div>
{/if}

<slot />
