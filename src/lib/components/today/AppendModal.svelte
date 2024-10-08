<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { todayPageErrorStore } from '$src/lib/stores/errors';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	// import { appLogger } from '$src/lib/utils/logger';
	import { Grid, Input, Modal } from '@svelteuidev/core';
	import { onMount } from 'svelte';

	export let goals: Goal[];
	export let opened: boolean;
	export let intention: Intention;
	export let closeModal: () => void;

	let showDBErrorNotification = false;

	let closeAppendModal = () => {
		opened = false;
		closeModal();
	};
	let appendText = async (text: string) => {
		if (intention.id != null) {
			try {
				await trpc($page).intentions.appendText.mutate({ id: intention.id, text });
				closeAppendModal();
				await invalidateAll();
			} catch (error) {
				if (error instanceof Error) {
					todayPageErrorStore.setError(error.message);
				}

				showDBErrorNotification = true;
			}
		}
	};
	let appendInputValue = () => {
		const appendInput = document.getElementById('append-text') as HTMLInputElement;
		if (appendInput) {
			appendText(appendInput.value);
		}
	};

	$: modalTitle = goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text;

	onMount(() => {
		const appendModal = document.querySelector('div[className="append-modal"]');
		if (appendModal) {
			const modalHeader = appendModal.querySelector('.svelteui-Modal-header');
			if (modalHeader) {
				modalHeader.setAttribute('style', 'justify-content: center;');
				// Modal title is a direct child but just in case, query for it
				const modalTitle = modalHeader.querySelector('.svelteui-Modal-title');
				if (modalTitle) {
					modalTitle.setAttribute('style', 'font-size: 1.5rem;');
				}
			}
		}
	});
</script>

<Modal
	className="append-modal"
	{opened}
	on:close={closeAppendModal}
	withCloseButton={false}
	title={'Append to this intention'}
	overlayOpacity={0.25}
>
	<p
		class="mb-8 text-center text-lg font-bold"
		style="color: {goalColorForIntention(intention, goals)}"
	>
		{modalTitle}
	</p>
	<Grid class="justify-center">
		<span class="w-11/12">
			<Input class="h-12 text-xl" id="append-text" />
		</span>
		<span class="append-buttons mt-8">
			<button
				class="daisy-btn-warning daisy-btn"
				on:click={closeAppendModal}
				on:keypress={(e) => {
					if (e.key === 'Enter') {
						closeAppendModal();
					}
				}}>Cancel</button
			>
			<button class="daisy-btn-primary daisy-btn" on:click={appendInputValue}>Append</button>
		</span>
	</Grid>
</Modal>

{#if showDBErrorNotification}
	<div class="daisy-toast">
		<div class="daisy-alert daisy-alert-error">
			<div>
				<span>Error saving intention</span>
			</div>
		</div>
	</div>
{/if}
