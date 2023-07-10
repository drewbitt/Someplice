<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import { Grid, Modal } from '@svelteuidev/core';
	import { onMount } from 'svelte';
	import TextCursorInput from '~icons/lucide/text-cursor-input';
	import AppendModal from './AppendModal.svelte';

	export let goals: Goal[];
	export let opened: boolean; // actual opened state to report to parent (to close modal + child modals)
	export let intention: Intention;

	let intentionsModalOpened = opened; // local opened state to control modal
	$: modalTitle = goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text;
	let showAppendModal = false;

	const closeIntentionsModal = () => {
		if (!showAppendModal) {
			opened = false;
		} else {
			intentionsModalOpened = false;
		}
	};
	const closeAppendModal = () => {
		showAppendModal = false;
		opened = false; // close modal in parent
	};

	onMount(() => {
		// Set css variable directly as a workaround for cssvariable not working in a parent div
		document.documentElement.style.setProperty(
			'--goal-color',
			goalColorForIntention(intention, goals)
		);

		const modalTitle = document.querySelector('.svelteui-Modal-title');
		if (modalTitle) {
			modalTitle.setAttribute(
				'style',
				'color: var(--goal-color); font-weight: bold; font-size: 1.1rem;'
			);
		}
	});
</script>

{#if intentionsModalOpened}
	<Modal
		className="intentions-modal"
		bind:opened={intentionsModalOpened}
		centered
		withCloseButton={false}
		title={modalTitle}
		overlayOpacity={0.25}
		on:close={closeIntentionsModal}
	>
		<Grid>
			<Grid.Col span={12}>
				<ul class="daisy-menu w-56 text-lg">
					<li>
						<span
							role="button"
							tabindex="0"
							class="grid"
							style="grid-template-columns: 0.5rem auto;"
							on:click={() => {
								showAppendModal = true;
								closeIntentionsModal();
							}}
							on:keypress={(e) => {
								if (e.key === 'Enter') {
									showAppendModal = true;
									closeIntentionsModal();
								}
							}}
						>
							<TextCursorInput class="h-6 w-6" />
							<button class="outline-none">Append Text</button>
						</span>
					</li>
				</ul>
			</Grid.Col>
		</Grid>
	</Modal>
{/if}

{#if showAppendModal}
	<AppendModal {goals} {intention} opened={showAppendModal} closeModal={closeAppendModal} />
{/if}
