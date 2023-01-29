<script lang="ts">
	import { Input, Text } from '@svelteuidev/core';

	export let currentlyEditing: boolean;
	export let title: string;
</script>

{#if currentlyEditing}
	<div class="goal-box-title-editable w-1/2">
		<Input bind:value={title} class={'text-3xl bg-transparent border-opacity-10 px-0'} />
	</div>
{:else}
	<div class="goal-box-title w-1/2">
		<Text class="text-3xl" color="white">{title}</Text>
	</div>
{/if}
