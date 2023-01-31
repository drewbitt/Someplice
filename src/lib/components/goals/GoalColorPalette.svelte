<script lang="ts">
	import { page } from '$app/stores';
	import { Box, Grid, Modal } from '@svelteuidev/core';
	import { colors } from './colors';
	import { trpc } from '$src/lib/trpc/client';

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
					<Box
						class="w-10 h-10 rounded-full cursor-pointer"
						css={{ background: color }}
						on:click={() => {
							goalColor = color;
							closeModal();
						}}
					/>
				</Grid.Col>
			{/each}
		{/await}
	</Grid>
</Modal>

<Box
	class="w-14 h-8 flex justify-center items-center cursor-pointer"
	css={{
		// TODO: chosen color, but lighter via hsl manipulation
		backgroundColor: 'black'
	}}
	on:click={() => (opened = true)}
>
	<Box class="w-6 h-6 border" css={{ background: goalColor }} />
</Box>
