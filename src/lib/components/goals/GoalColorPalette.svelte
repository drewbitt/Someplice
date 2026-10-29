<script lang="ts">
	import { trpc } from '#lib/trpc/client.js';
	import { lightenHSL } from '#lib/utils/index.js';
	import { colors } from './colors';

	let { goalColor = $bindable(), goalId }: { goalColor: string; goalId?: number | null } = $props();
	const headingId = $props.id();

	let opened = $state(false);
	let dialogEl: HTMLDialogElement;

	$effect(() => {
		if (dialogEl) {
			if (opened) {
				dialogEl.showModal();
			} else {
				dialogEl.close();
			}
		}
	});

	let availableColorsPromise = $state<Promise<string[]> | undefined>(undefined);

	function loadColors() {
		availableColorsPromise = trpc()
			.goals.list.query(1)
			.then((allGoals) => {
				const usedColors = new Set(
					allGoals.filter((goal) => goalId == null || goal.id !== goalId).map((goal) => goal.color)
				);
				return colors.filter((color) => !usedColors.has(color));
			});
	}
</script>

<dialog
	class="modal"
	aria-labelledby={headingId}
	bind:this={dialogEl}
	onclose={() => (opened = false)}
>
	<div class="modal-box">
		<h3 id={headingId} class="text-lg font-bold">Choose Goal Color</h3>
		<div class="grid grid-cols-4 gap-2">
			{#await availableColorsPromise}
				<div class="col-span-4 text-center">Loading…</div>
			{:then availColors}
				{#each availColors as color (color)}
					<div class="flex justify-center">
						<button
							type="button"
							aria-label={`Use ${color}`}
							style="background-color: {color}"
							class="size-10 cursor-pointer rounded-full"
							onclick={() => {
								goalColor = color;
								opened = false;
							}}
						></button>
					</div>
				{/each}
			{:catch}
				<div class="col-span-4" role="alert">
					<p>Could not load goal colors.</p>
					<button type="button" class="btn" onclick={loadColors}>Retry</button>
				</div>
			{/await}
		</div>
	</div>
	<button
		type="button"
		class="modal-backdrop"
		aria-label="Close color picker"
		onclick={() => (opened = false)}
	></button>
</dialog>

<button
	type="button"
	aria-label="Choose goal color"
	aria-haspopup="dialog"
	aria-expanded={opened}
	style="background-color: {lightenHSL(goalColor, 0.2)}"
	class="flex h-8 w-14 cursor-pointer items-center justify-center"
	onclick={() => {
		loadColors();
		opened = true;
	}}
>
	<span style="background-color: {goalColor}" class="size-6 border"></span>
</button>
