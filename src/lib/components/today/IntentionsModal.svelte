<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import TextCursorInput from 'virtual:icons/lucide/text-cursor-input';
	import AppendModal from './AppendModal.svelte';

	let {
		goals,
		opened = $bindable(),
		intention
	}: { goals: Goal[]; opened: boolean; intention: Intention } = $props();

	let dialog: HTMLDialogElement;
	let intentionsModalOpened = $state(opened);
	let showAppendModal = $state(false);

	let modalTitle = $derived(goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text);

	$effect(() => {
		if (dialog) {
			if (intentionsModalOpened) {
				dialog.showModal();
				dialog.style.setProperty('--goal-color', goalColorForIntention(intention, goals));
			} else {
				dialog.close();
			}
		}
	});

	const closeIntentionsModal = () => {
		if (!showAppendModal) {
			opened = false;
		} else {
			intentionsModalOpened = false;
		}
	};

	const closeAppendModal = () => {
		showAppendModal = false;
		opened = false;
	};
</script>

<dialog bind:this={dialog} class="modal" onclose={closeIntentionsModal}>
	<div class="modal-box border-t-4 border-t-(--goal-color)">
		<h3 class="goal-text text-lg font-bold">{modalTitle}</h3>
		<div class="py-4">
			<ul class="menu w-56 text-lg">
				<li>
					<button
						class="focus:text-base-content flex items-center gap-3"
						onclick={() => {
							showAppendModal = true;
							closeIntentionsModal();
						}}
					>
						<TextCursorInput class="size-6" />
						<span>Append Text</span>
					</button>
				</li>
			</ul>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

{#if showAppendModal}
	<AppendModal {goals} {intention} opened={showAppendModal} closeModal={closeAppendModal} />
{/if}
