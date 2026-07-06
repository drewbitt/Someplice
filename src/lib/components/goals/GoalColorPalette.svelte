<script lang="ts">
	import { trpc } from '$src/lib/trpc/client';
	import { lighterHSLColor } from '$src/lib/utils';
	import { colors } from './colors';

	export let goalColor: string;

	let opened = false;
	let dialogEl: HTMLDialogElement;

	$: {
		if (dialogEl) {
			if (opened) {
				dialogEl.showModal();
			} else {
				dialogEl.close();
			}
		}
	}

	const availableColors = async () => {
		const allGoals = await trpc().goals.list.query(1);
		const usedColors = allGoals.map((goal) => goal.color);
		return colors.filter((color) => !usedColors.includes(color));
	};
</script>

<dialog class=" modal" bind:this={dialogEl} on:close={() => (opened = false)}>
	<div class=" modal-box">
		<h3 class="text-lg font-bold">Choose Goal Color</h3>
		<div class="grid grid-cols-4 gap-2">
			{#await availableColors()}
				<div class="col-span-4 text-center">Loading...</div>
			{:then availColors}
				{#each availColors as color (color)}
					<div class="flex justify-center">
						<div
							tabindex="0"
							role="button"
							style="background-color: {color}"
							class="h-10 w-10 cursor-pointer rounded-full"
							on:click={() => {
								goalColor = color;
								opened = false;
							}}
							on:keydown={(event) => {
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
	<form method="dialog" class=" modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<div
	tabindex="0"
	role="button"
	style="--lighter-goal-color: {lighterHSLColor(goalColor)}"
	class="goal-box-color-picker flex h-8 w-14 cursor-pointer items-center justify-center"
	on:click={() => (opened = true)}
	on:keydown={(event) => {
		if (event.key === 'Enter') {
			opened = true;
		}
	}}
>
	<div
		style="--goal-color: {goalColor}"
		class="goal-box-color-picker-color-current h-6 w-6 border"
	/>
</div>

<style>
	.goal-box-color-picker {
		background-color: var(--lighter-goal-color);
	}
	.goal-box-color-picker-color-current {
		background-color: var(--goal-color);
	}
</style>
