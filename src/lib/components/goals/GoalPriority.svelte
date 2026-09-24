<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Priority } from '$src/lib/trpc/types';
	import { goalPageErrorStore } from '$src/lib/stores/errors.svelte';
	import { darkerHSLColor } from '$src/lib/utils';
	import Check from 'virtual:icons/lucide/check';
	import Pencil from 'virtual:icons/lucide/pencil';
	import Plus from 'virtual:icons/lucide/plus';

	let {
		goal,
		priority
	}: {
		goal: Pick<Goal, 'id' | 'orderNumber' | 'title' | 'color'>;
		priority: Priority | null | undefined;
	} = $props();

	let editing = $state(false);
	let textDraft = $state('');
	let checkInDateDraft = $state('');
	// svelte-ignore state_referenced_locally
	let descriptionDraft = $state(priority?.description ?? '');
	let showCompletePrompt = $state(false);
	let reflectionDraft = $state('');
	// svelte-ignore non_reactive_update
	let completeDialog: HTMLDialogElement;

	$effect(() => {
		if (completeDialog) {
			if (showCompletePrompt) {
				completeDialog.showModal();
			} else {
				completeDialog.close();
			}
		}
	});

	const reportError = (error: unknown) => {
		if (error instanceof Error) {
			goalPageErrorStore.setError(error.message);
		}
	};

	const startEditing = () => {
		textDraft = priority?.text ?? '';
		checkInDateDraft = priority?.checkInDate ?? '';
		descriptionDraft = priority?.description ?? '';
		editing = true;
	};

	const savePriority = async () => {
		if (!textDraft.trim()) return;
		try {
			if (priority?.id) {
				await trpc().priorities.edit.mutate({
					id: priority.id,
					text: textDraft.trim(),
					checkInDate: checkInDateDraft || null,
					description: descriptionDraft || null
				});
			} else if (goal.id) {
				await trpc().priorities.upsert.mutate({
					goalId: goal.id,
					text: textDraft.trim(),
					checkInDate: checkInDateDraft || null,
					description: descriptionDraft || null
				});
			}
			editing = false;
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};

	const saveDescription = async () => {
		if (!priority?.id || descriptionDraft === (priority.description ?? '')) return;
		try {
			await trpc().priorities.edit.mutate({
				id: priority.id,
				description: descriptionDraft || null
			});
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};

	const completePriority = async () => {
		if (!priority?.id) return;
		try {
			await trpc().priorities.complete.mutate({
				id: priority.id,
				reflection: reflectionDraft || null
			});
			showCompletePrompt = false;
			reflectionDraft = '';
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};

	const clearPriority = async () => {
		if (!priority?.id) return;
		try {
			await trpc().priorities.clear.mutate({ goalId: priority.goalId });
			editing = false;
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};
</script>

{#if editing}
	<form
		class="goal-priority-edit mx-5 flex flex-col gap-2 rounded-md border border-dashed p-3"
		style="border-color: {goal.color}"
		onsubmit={(event) => {
			event.preventDefault();
			savePriority();
		}}
	>
		<input
			class="input input-bordered w-full"
			placeholder="Top priority"
			aria-label="Top priority"
			bind:value={textDraft}
		/>
		<label class="flex items-center gap-2">
			<span class="whitespace-nowrap">by</span>
			<input
				type="date"
				class="input input-bordered w-full"
				aria-label="Check-in date"
				bind:value={checkInDateDraft}
			/>
		</label>
		<textarea
			class="textarea textarea-bordered w-full"
			placeholder="Description: what's the highest priority thing for the next week or month for this goal?"
			aria-label="Priority description"
			bind:value={descriptionDraft}></textarea>
		<div class="flex justify-end gap-2">
			{#if priority}
				<button type="button" class="btn mr-auto" onclick={clearPriority}>Clear</button>
			{/if}
			<button type="button" class="btn" onclick={() => (editing = false)}>Cancel</button>
			<button type="submit" class="btn btn-primary" disabled={!textDraft.trim()}>Save</button>
		</div>
	</form>
{:else if priority}
	<div class="goal-priority mx-5">
		<div
			class="flex items-center justify-between gap-2 px-3 py-1.5 font-semibold text-white"
			style="background-color: {darkerHSLColor(goal.color)}"
		>
			<span class="min-w-0 truncate">
				Top Priority&nbsp;|&nbsp;{priority.text}{#if priority.checkInDate}&nbsp;|&nbsp;by {priority.checkInDate}{/if}
			</span>
			<span class="flex shrink-0">
				<button
					class="btn-ghost btn-xs btn"
					aria-label="Edit top priority for goal {goal.orderNumber}"
					onclick={startEditing}
				>
					<Pencil class="size-4" />
				</button>
				<button
					class="btn-ghost btn-xs btn"
					aria-label="Complete top priority for goal {goal.orderNumber}"
					onclick={() => (showCompletePrompt = true)}
				>
					<Check class="size-4" />
				</button>
			</span>
		</div>
		<textarea
			class="textarea w-full rounded-none border-0 text-base italic focus:outline-none"
			style="background-color: {darkerHSLColor(goal.color)}20"
			placeholder="Description: what's the highest priority thing for the next week or month for this goal?"
			aria-label="Priority description for goal {goal.orderNumber}"
			bind:value={descriptionDraft}
			onchange={saveDescription}></textarea>
	</div>
{:else}
	<button
		class="goal-priority-create mx-5 flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 font-semibold opacity-80 hover:opacity-100"
		style="border-color: {goal.color}; color: {goal.color}"
		onclick={startEditing}
	>
		<Plus class="size-4" />
		top priority
	</button>
{/if}

<dialog bind:this={completeDialog} class="modal" onclose={() => (showCompletePrompt = false)}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Complete top priority</h3>
		<p class="py-2">"{priority?.text}"</p>
		<textarea
			class="textarea textarea-bordered w-full"
			placeholder="Reflection (optional)"
			aria-label="Reflection"
			bind:value={reflectionDraft}></textarea>
		<div class="modal-action">
			<button class="btn" onclick={() => (showCompletePrompt = false)}>Cancel</button>
			<button class="btn btn-primary" onclick={completePriority}>Complete</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
