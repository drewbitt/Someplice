<script lang="ts">
	import { trpc } from '$src/lib/trpc/client';
	import { lighterHSLColor } from '$src/lib/utils';
	import { colors } from './colors';

	let { goalColor = $bindable() }: { goalColor: string } = $props();

	let opened = false;
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

	$effect(() => {
		if (opened && !availableColorsPromise) {
			availableColorsPromise = (async () => {
				const allGoals = await trpc().goals.list.query(1);
				const usedColors = allGoals.map((goal) => goal.color);
				return colors.filter((color) => !usedColors.includes(color));
			})();
		}
	});
</script>

<dialog class="modal" bind:this={dialogEl} onclose={() => (opened = false)}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Choose Goal Color</h3>
		<div class="grid grid-cols-4 gap-2">
			{#await availableColorsPromise}
				<div class="col-span-4 text-center">Loading...</div>
			{:then availColors}
				{#each availColors as color (color)}
					<div class="flex justify-center">
						<div
							tabindex="0"
							role="button"
							style="background-color: {color}"
							class="h-10 w-10 cursor-pointer rounded-full"
							onclick={() => {
								goalColor = color;
								opened = false;
							}}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									goalColor = color;
									opened = false;
								}
							}}
						/>
					</div>
				{/each}
			{/await}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<div
	tabindex="0"
	role="button"
	style="background-color: {lighterHSLColor(goalColor)}"
	class="flex h-8 w-14 cursor-pointer items-center justify-center"
	onclick={() => (opened = true)}
	onkeydown={(event) => {
		if (event.key === 'Enter') {
			opened = true;
		}
	}}
>
	<div
		style="background-color: {goalColor}"
		class="h-6 w-6 border"
	/>
</div>
