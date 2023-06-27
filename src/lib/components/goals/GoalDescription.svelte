<script lang="ts">
	import { Box, Group, Text } from '@svelteuidev/core';
	import Archive from 'virtual:icons/lucide/archive';
	import Trash from 'virtual:icons/lucide/trash-2';

	export let currentlyEditing: boolean;
	export let description: string | null;
	export let handleDeleteGoal: () => Promise<void>;
	export let handleArchiveGoal: () => Promise<void>;
	// goalColor is HSL
</script>

{#if currentlyEditing}
	<div class="goal-box-description-editable w-full">
		<Group position="apart">
			<textarea
				class="bg-white text-black py-1 px-2 w-5/6 max-w-6xl rounded-md border border-transparent overflow-visible"
				placeholder="Describe your goal"
				bind:value={description}
			/>
			<Box class="flex">
				<button
					id="goal-box-archive-button"
					class="mr-2 p-1.5 rounded-lg bg-blue-600 daisy-btn-sm"
					on:click={handleArchiveGoal}
				>
					<Archive class="text-white" />
				</button>
				<button
					id="goal-box-delete-button"
					aria-haspopup="true"
					class="mr-3.5 p-1.5 rounded-lg bg-red-600 daisy-btn-sm"
					on:click={handleDeleteGoal}
				>
					<Trash class="text-white" />
				</button>
			</Box>
		</Group>
	</div>
{:else}
	<div class="goal-box-description w-full">
		<Text>{description ?? ''}</Text>
	</div>
{/if}
