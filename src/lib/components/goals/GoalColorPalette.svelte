<script lang="ts">
	import { page } from '$app/stores';
	import { Box, Grid, Modal } from '@svelteuidev/core';
	import { colors } from './colors';
	import { trpc } from '$src/lib/trpc/client';
	import { cssvariable } from '@svelteuidev/composables';

	export let goalColor: string;

	let opened = false;
	let closeModal = () => (opened = false);

	const availableColors = async () => {
		const allGoals = await trpc($page).goals.list.query(1);
		const usedColors = allGoals.map((goal) => goal.color);
		return colors.filter((color) => !usedColors.includes(color));
	};

	// make a lighter version of goalColor via maniuplating the goalColor variable via hsl
	const lighterGoalColor = (color: string) => {
		const [hue, saturation, lightness] = color
			.slice(4, -1)
			.split(' ')
			.map((x) => parseFloat(x));
		const lighterLightness = lightness + (100 - lightness) * 0.2;
		return `hsl(${hue},${saturation}%,${lighterLightness}%)`;
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
						class="goal-box-color-picker-color w-10 h-10 rounded-full cursor-pointer"
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
	use:cssvariable={{ 'lighter-goal-color': lighterGoalColor(goalColor) }}
	class="goal-box-color-picker w-14 h-8 flex justify-center items-center cursor-pointer"
	on:click={() => (opened = true)}
	on:keydown={(event) => {
		if (event.key === 'Enter') {
			opened = true;
		}
	}}
>
	<div
		use:cssvariable={{ 'goal-color': goalColor }}
		class="goal-box-color-picker-color-current w-6 h-6 border"
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