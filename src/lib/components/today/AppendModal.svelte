<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import { Grid, Modal } from '@svelteuidev/core';
	import { onMount } from 'svelte';

	export let goals: Goal[];
	export let opened: boolean;
	export let intention: Intention;
	export let closeModal: () => void;

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
	on:close={() => {
		opened = false;
		closeModal();
	}}
	withCloseButton={false}
	title={'Append to this intention'}
	overlayOpacity={0.25}
>
	<p class="font-bold text-center text-lg" style="color: {goalColorForIntention(intention, goals)}">
		{modalTitle}
	</p>
</Modal>
