<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import { lighterHSLColor } from '$src/lib/utils';
	import { cssvariable } from '@svelteuidev/composables';
	import { Box, Grid, Modal } from '@svelteuidev/core';
	import { colors } from './colors';

	export let goalColor: string;

	let opened = false;
	let closeModal = () => (opened = false);

	const availableColors = async () => {
		const allGoals = await trpc($page).goals.list.query(1);
		const usedColors = allGoals.map((goal) => goal.color);
		return colors.filter((color) => !usedColors.includes(color));
	};
</script>

<Modal {opened} on:close={closeModal} withCloseButton={false} title="Choose Goal Color">
	<Grid>
		{#await availableColors()}
			<Grid.Col span={12}>
				<Box class="text-center">Loading...</Box>
			</Grid.Col>
		{:then availColors}
			{#each availColors as color}
				<Grid.Col span={3}>
					<div
						tabindex="0"
						role="button"
						style="background-color: {color}"
						class="goal-box-color-picker-color h-10 w-10 cursor-pointer rounded-full"
						on:click={() => {
							goalColor = color;
							closeModal();
						}}
						on:keydown={(event) => {
							if (event.key === 'Enter') {
								goalColor = color;
								closeModal();
							}
						}}
					/>
				</Grid.Col>
			{/each}
		{/await}
	</Grid>
</Modal>

<div
	tabindex="0"
	role="button"
	use:cssvariable={{ 'lighter-goal-color': lighterHSLColor(goalColor) }}
	class="goal-box-color-picker flex h-8 w-14 cursor-pointer items-center justify-center"
	on:click={() => (opened = true)}
	on:keydown={(event) => {
		if (event.key === 'Enter') {
			opened = true;
		}
	}}
>
	<div
		use:cssvariable={{ 'goal-color': goalColor }}
		class="goal-box-color-picker-color-current h-6 w-6 border"
		style="background-color: {goalColor}"
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
