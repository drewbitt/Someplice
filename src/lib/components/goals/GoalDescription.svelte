<script lang="ts">
	import { Box, Group, Text } from '@svelteuidev/core';
	import Archive from 'virtual:icons/lucide/archive';
	import ArchiveRestore from 'virtual:icons/lucide/archive-restore';
	import Trash from 'virtual:icons/lucide/trash-2';

	export let currentlyEditing: boolean;
	export let description: string | null;
	export let handleDeleteGoal: () => Promise<void>;
	export let handleArchiveGoal: () => Promise<void>;
	export let handleRestoreGoal: () => Promise<void>;
	export let isInactiveGoal = false;
</script>

{#if currentlyEditing && !isInactiveGoal}
	<Box class="goal-box-description-editable w-full">
		<Group position="apart">
			<textarea
				class="w-5/6 max-w-6xl overflow-visible rounded-md border border-transparent bg-white px-2 py-1 text-black"
				placeholder="Describe your goal"
				bind:value={description}
			/>
			<Box class="flex">
				<button
					id="goal-box-archive-button"
					class="daisy-btn-sm mr-2 rounded-lg bg-blue-600 p-1.5"
					on:click={handleArchiveGoal}
				>
					<Archive class="text-white" />
				</button>
				<button
					id="goal-box-delete-button"
					aria-haspopup="true"
					class="daisy-btn-sm mr-3.5 rounded-lg bg-red-600 p-1.5"
					on:click={handleDeleteGoal}
				>
					<Trash class="text-white" />
				</button>
			</Box>
		</Group>
	</Box>
{:else if currentlyEditing && isInactiveGoal}
	<Box class="goal-box-description w-full">
		<Group position="apart">
			<Text>{description ?? ''}</Text>
			<Box class="flex">
				<button
					id="goal-box-archive-button"
					class="daisy-btn-sm mr-2 rounded-lg bg-blue-600 p-1.5"
					on:click={handleRestoreGoal}
				>
					<ArchiveRestore class="text-white" />
				</button>
				<button
					id="goal-box-delete-button"
					aria-haspopup="true"
					class="daisy-btn-sm mr-3.5 rounded-lg bg-red-600 p-1.5"
					on:click={handleDeleteGoal}
				>
					<Trash class="text-white" />
				</button>
			</Box>
		</Group>
	</Box>
{:else}
	<Box class="goal-box-description w-full">
		<Text>{description ?? ''}</Text>
	</Box>
{/if}
