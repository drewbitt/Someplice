<script lang="ts">
	import { todayPageErrorStore } from '$src/lib/stores/errors';
	import X from 'virtual:icons/lucide/x';
</script>

{#if $todayPageErrorStore}
	<div class="daisy-toast daisy-toast-center">
		<div class="daisy-alert daisy-alert-error flex gap-2">
			<button
				class="daisy-btn daisy-btn-circle daisy-btn-sm"
				on:click={() => todayPageErrorStore.setError(null)}
			>
				<X />
			</button>
			<p>{$todayPageErrorStore}</p>
		</div>
	</div>
{/if}

<slot />
