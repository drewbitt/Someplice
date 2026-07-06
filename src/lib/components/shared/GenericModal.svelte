<script lang="ts">
	export let showModal: boolean;
	export let actionConfirmed: boolean;
	export let title: string;
	export let message: string;
	export let action: string;
	export let actionButtonClass: string;

	let dialog: HTMLDialogElement;

	$: if (dialog) {
		if (showModal) {
			dialog.showModal();
		} else {
			dialog.close();
		}
	}
</script>

<dialog bind:this={dialog} class=" modal" on:close={() => (showModal = false)}>
	<div class=" modal-box">
		<h3 class="text-lg font-bold">{title}</h3>
		<p class="py-4">{message}</p>
		<div class=" modal-action">
			<button
				class=" btn  btn-warning"
				on:click={() => {
					showModal = false;
				}}
			>
				Cancel
			</button>
			<button
				class={actionButtonClass}
				on:click={() => {
					actionConfirmed = true;
					showModal = false;
				}}
			>
				{action}
			</button>
		</div>
	</div>
	<form method="dialog" class=" modal-backdrop">
		<button>close</button>
	</form>
</dialog>
