<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { todayPageErrorStore } from '#src/lib/stores/errors.svelte.js';
	import { trpc } from '#src/lib/trpc/client.js';
	import type { Goal, Intention } from '#src/lib/trpc/types.js';
	import { goalColorForIntention, goalOrderNumberForId } from '#src/lib/utils/index.js';

	let {
		goals,
		opened,
		intention,
		closeModal
	}: { goals: Goal[]; opened: boolean; intention: Intention; closeModal: () => void } = $props();

	let showDBErrorNotification = $state(false);
	let dialogEl: HTMLDialogElement;

	let closeAppendModal = () => {
		opened = false;
		dialogEl?.close();
		closeModal();
	};
	let appendText = async (text: string) => {
		if (intention.id != null) {
			try {
				await trpc().intentions.appendText.mutate({ id: intention.id, text });
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
	// Scoped element ref — a global document.getElementById('append-text')
	// lookup returns the first match, which may be another instance's input.
	let appendInput: HTMLInputElement;
	let appendInputValue = () => {
		if (appendInput) {
			appendText(appendInput.value);
		}
	};

	let modalTitle = $derived(goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text);

	$effect(() => {
		if (dialogEl) {
			if (opened) {
				dialogEl.showModal();
			} else {
				dialogEl.close();
			}
		}
	});
</script>

<dialog class="modal" bind:this={dialogEl} onclose={closeAppendModal}>
	<div class="modal-box">
		<h3 class="text-center text-lg font-bold">Append to this intention</h3>
		<p
			class="goal-text mb-8 text-center text-lg font-bold"
			style="--goal-color: {goalColorForIntention(intention, goals)}"
		>
			{modalTitle}
		</p>
		<div class="flex flex-col items-center">
			<span class="w-11/12">
				<input
					class="input h-12 w-full text-xl"
					aria-label="Text to append"
					autocomplete="off"
					bind:this={appendInput}
				/>
			</span>
			<span class="append-buttons mt-8 flex gap-2">
				<button
					class="btn btn-warning"
					onclick={closeAppendModal}
					onkeypress={(e) => {
						if (e.key === 'Enter') {
							closeAppendModal();
						}
					}}>Cancel</button
				>
				<button class="btn btn-primary" onclick={appendInputValue}>Append</button>
			</span>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

{#if showDBErrorNotification}
	<div class="toast">
		<div role="alert" class="alert alert-error">
			<div>
				<span>Error saving intention</span>
			</div>
		</div>
	</div>
{/if}
