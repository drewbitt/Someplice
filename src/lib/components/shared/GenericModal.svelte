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

	$effect(() => {
		if (dialog) {
			if (showModal) {
				dialog.showModal();
			} else {
				dialog.close();
			}
		}
	});
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (showModal = false)}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">{title}</h3>
		<p class="py-4">{message}</p>
		<div class="modal-action">
			<button
				class="btn btn-warning"
				onclick={() => {
					showModal = false;
				}}
			>
				Cancel
			</button>
			<button
				class={actionButtonClass}
				onclick={() => {
					actionConfirmed = true;
					showModal = false;
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
