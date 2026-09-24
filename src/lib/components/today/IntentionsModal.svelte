<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { trpc } from '$src/lib/trpc/client';
	import { todayPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import TextCursorInput from 'virtual:icons/lucide/text-cursor-input';
	import Trash2 from 'virtual:icons/lucide/trash-2';
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

	const deleteIntention = async () => {
		if (intention.id != null) {
			try {
				await trpc().intentions.delete.mutate(intention.id);
				opened = false;
				dialog?.close();
				await invalidateAll();
			} catch (error) {
				if (error instanceof Error) {
					todayPageErrorStore.setError(error.message);
				}
			}
		}
	};
</script>

<dialog bind:this={dialog} class="modal" onclose={closeIntentionsModal}>
	<div class="modal-box" style="border-top: 4px solid var(--goal-color)">
		<h3 class="text-lg font-bold" style="color: var(--goal-color)">{modalTitle}</h3>
		<div class="py-4">
			<ul class="menu w-56 text-lg">
				<li>
					<button
						class="focus:text-base-content flex items-center gap-3"
						style="grid-template-columns: 0.5rem auto;"
						onclick={() => {
							showAppendModal = true;
							closeIntentionsModal();
						}}
					>
						<TextCursorInput class="h-6 w-6" />
						<span>Append Text</span>
					</button>
				</li>
				<li>
					<button
						class="flex items-center gap-3"
						class:focus:text-slate-200={darkMode}
						class:focus:text-slate-900={!darkMode}
						style="grid-template-columns: 0.5rem auto;"
						onclick={deleteIntention}
					>
						<Trash2 class="h-6 w-6" />
						<span>Delete</span>
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
