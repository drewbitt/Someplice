<script lang="ts">
	import { Group, Modal, Stack } from '@svelteuidev/core';
	import { onMount } from 'svelte';

	export let showModal: boolean;
	export let actionConfirmed: boolean;
	export let title: string;
	export let message: string;
	export let action: string;
	export let actionButtonClass: string;

	onMount(() => {
		const modalTitle = document.querySelector('.svelteui-Modal-title');
		if (modalTitle) {
			modalTitle.setAttribute('style', 'font-size: 1.25rem; line-height: 1.75rem;');
		}
	});
</script>

<Modal opened={showModal} on:close={() => (showModal = false)} {title} withCloseButton={false}>
	<Stack spacing="xs">
		<p>{message}</p>
		<Group position="right">
			<button
				class="daisy-btn-warning daisy-btn"
				on:click={() => {
					showModal = false;
				}}
			>
				Cancel
			</button>
			<button
				class={actionButtonClass}
				on:click={() => {
					actionConfirmed = true;
					showModal = false;
				}}
			>
				{action}
			</button>
		</Group>
	</Stack>
</Modal>
