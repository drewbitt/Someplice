<script lang="ts">
	import { Group, Modal, Stack } from '@svelteuidev/core';
	import { onMount } from 'svelte';

	export let showDeletionPrompt: boolean;
	export let deletionConfirmed: boolean;

	onMount(() => {
		const modalTitle = document.querySelector('.svelteui-Modal-title');
		if (modalTitle) {
			modalTitle.setAttribute('style', 'font-size: 1.25rem; line-height: 1.75rem;');
		}
	});
</script>

<Modal
	opened={showDeletionPrompt}
	on:close={() => (showDeletionPrompt = false)}
	title="Delete Goal"
	withCloseButton={false}
>
	<Stack spacing="xs">
		<p>Are you sure you want to delete this goal? This action is irreversible.</p>
		<Group position="right">
			<button
				class="daisy-btn daisy-btn-warning"
				on:click={() => {
					showDeletionPrompt = false;
				}}
			>
				Cancel
			</button>
			<button
				class="daisy-btn daisy-btn-error"
				on:click={() => {
					deletionConfirmed = true;
				}}
			>
				Delete
			</button>
		</Group>
	</Stack>
</Modal>
