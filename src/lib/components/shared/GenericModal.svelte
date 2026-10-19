<script lang="ts">
	let {
		showModal = $bindable(),
		actionConfirmed = $bindable(),
		title,
		message,
		action,
		actionButtonClass
	}: {
		showModal: boolean;
		actionConfirmed: boolean;
		title: string;
		message: string;
		action: string;
		actionButtonClass: string;
	} = $props();

	let dialog: HTMLDialogElement;
	let returnFocus: HTMLElement | null = null;

	$effect(() => {
		if (dialog) {
			if (showModal) {
				// Re-opening must clear the previous confirm so a failed action
				// that reopens the modal can't fire without a fresh click.
				actionConfirmed = false;
				returnFocus = document.activeElement as HTMLElement | null;
				dialog.showModal();
			} else {
				dialog.close();
			}
		}
	});

	const restoreFocus = () => {
		const el = returnFocus;
		returnFocus = null;
		if (el?.isConnected) requestAnimationFrame(() => el.focus());
	};
</script>

<dialog
	bind:this={dialog}
	class="modal"
	onclose={() => {
		showModal = false;
		restoreFocus();
	}}
>
	<div class="modal-box">
		<h3 class="text-lg font-bold">{title}</h3>
		<p class="py-4">{message}</p>
		<div class="modal-action">
			<button
				class="btn btn-warning"
				onclick={() => {
					showModal = false;
					restoreFocus();
				}}
			>
				Cancel
			</button>
			<button
				class={actionButtonClass}
				onclick={() => {
					actionConfirmed = true;
					showModal = false;
					restoreFocus();
				}}
			>
				{action}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
