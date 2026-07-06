<script lang="ts">
	import type { Goal, Intention } from '$src/lib/trpc/types';
	import { goalColorForIntention, goalOrderNumberForId } from '$src/lib/utils';
	import theme from '$lib/stores/theme';
	import TextCursorInput from 'virtual:icons/lucide/text-cursor-input';
	import AppendModal from './AppendModal.svelte';

	export let goals: Goal[];
	export let opened: boolean;
	export let intention: Intention;

	let dialog: HTMLDialogElement;
	let intentionsModalOpened = opened;
	let showAppendModal = false;

	$: modalTitle = goalOrderNumberForId(intention.goalId, goals) + ') ' + intention.text;
	$: darkMode = $theme === 'dark';

	$: if (dialog) {
		if (intentionsModalOpened) {
			dialog.showModal();
			dialog.style.setProperty('--goal-color', goalColorForIntention(intention, goals));
		} else {
			dialog.close();
		}
	}

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

<dialog
	bind:this={dialog}
	class=" modal"
	on:close={closeIntentionsModal}
>
	<div class=" modal-box" style="border-top: 4px solid var(--goal-color)">
		<h3 class="text-lg font-bold" style="color: var(--goal-color)">{modalTitle}</h3>
		<div class="py-4">
			<ul class=" menu w-56 text-lg">
				<li>
					<button
						class="flex items-center gap-3"
						class:focus:text-slate-200={darkMode}
						class:focus:text-slate-900={!darkMode}
						style="grid-template-columns: 0.5rem auto;"
						on:click={() => {
							showAppendModal = true;
							closeIntentionsModal();
						}}
					>
						<TextCursorInput class="h-6 w-6" />
						<span>Append Text</span>
					</button>
				</li>
			</ul>
		</div>
	</div>
	<form method="dialog" class=" modal-backdrop">
		<button>close</button>
	</form>
</dialog>

{#if showAppendModal}
	<AppendModal {goals} {intention} opened={showAppendModal} closeModal={closeAppendModal} />
{/if}
