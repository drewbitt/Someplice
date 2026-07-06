<script lang="ts">
	import Archive from 'virtual:icons/lucide/archive';
	import ArchiveRestore from 'virtual:icons/lucide/archive-restore';
	import Trash from 'virtual:icons/lucide/trash-2';

	let {
		currentlyEditing,
		description,
		handleDeleteGoal,
		handleArchiveGoal,
		handleRestoreGoal,
		isInactiveGoal = false
	}: {
		currentlyEditing: boolean;
		description: string | null;
		handleDeleteGoal: () => Promise<void>;
		handleArchiveGoal: () => Promise<void>;
		handleRestoreGoal: () => Promise<void>;
		isInactiveGoal?: boolean;
	} = $props();
</script>

{#if currentlyEditing && !isInactiveGoal}
	<div class="goal-box-description-editable w-full">
		<div class="flex items-center justify-between">
			<textarea
				class="w-5/6 max-w-6xl overflow-visible rounded-md border border-transparent bg-white px-2 py-1 text-black"
				placeholder="Describe your goal"
				bind:value={description}
			></textarea>
			<div class="flex">
				<button
					id="goal-box-archive-button"
					class="btn-sm mr-2 rounded-lg bg-blue-600 p-1.5"
					onclick={handleArchiveGoal}
				>
					<Archive class="text-white" />
				</button>
				<button
					id="goal-box-delete-button"
					aria-haspopup="true"
					class="btn-sm mr-3.5 rounded-lg bg-red-600 p-1.5"
					onclick={handleDeleteGoal}
				>
					<Trash class="text-white" />
				</button>
			</div>
		</div>
	</div>
{:else if currentlyEditing && isInactiveGoal}
	<div class="goal-box-description w-full">
		<div class="flex items-center justify-between">
			<p class="text-base-content/80">{description ?? ''}</p>
			<div class="flex">
				<button
					id="goal-box-archive-button"
					class="btn-sm mr-2 rounded-lg bg-blue-600 p-1.5"
					onclick={handleRestoreGoal}
				>
					<ArchiveRestore class="text-white" />
				</button>
				<button
					id="goal-box-delete-button"
					aria-haspopup="true"
					class="btn-sm mr-3.5 rounded-lg bg-red-600 p-1.5"
					onclick={handleDeleteGoal}
				>
					<Trash class="text-white" />
				</button>
			</div>
		</div>
	</div>
{:else}
	<div class="goal-box-description w-full">
		<p class="text-base-content/80">{description ?? ''}</p>
	</div>
{/if}
