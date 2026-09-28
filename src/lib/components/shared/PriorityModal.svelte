<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { trpc } from '$src/lib/trpc/client';
	import type { Goal, Priority } from '$src/lib/trpc/types';
	import { appLogger } from '$src/lib/utils/logger';

	let {
		showModal = $bindable(),
		goal,
		priority = null,
		onError
	}: {
		showModal: boolean;
		goal: Pick<Goal, 'id' | 'orderNumber' | 'title' | 'color'>;
		/** When set, the modal edits this priority instead of creating a new one. */
		priority?: Priority | null;
		onError?: (message: string) => void;
	} = $props();

	let dialog: HTMLDialogElement;
	let text = $state('');
	let checkInDate = $state('');
	let description = $state('');
	let reflection = $state('');

	$effect(() => {
		if (dialog) {
			if (showModal) {
				text = priority?.text ?? '';
				checkInDate = priority?.checkInDate ?? '';
				description = priority?.description ?? '';
				reflection = '';
				if (!dialog.open) {
					dialog.showModal();
				}
			} else {
				if (dialog.open) {
					dialog.close();
				}
			}
		}
	});

	const reportError = (error: unknown) => {
		appLogger.error('Error saving priority', error);
		if (error instanceof Error) {
			onError?.(error.message);
		}
	};

	const handleSave = async () => {
		if (!text.trim()) return;
		try {
			if (goal.id) {
				await trpc().priorities.upsert.mutate({
					goalId: goal.id,
					text: text.trim(),
					description: description || null,
					checkInDate: checkInDate || null
				});
			}
			showModal = false;
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};

	const handleClear = async () => {
		if (!goal.id) return;
		try {
			await trpc().priorities.clear.mutate({ goalId: goal.id });
			showModal = false;
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};

	const handleComplete = async () => {
		if (!priority?.id) return;
		try {
			await trpc().priorities.complete.mutate({
				id: priority.id,
				reflection: reflection || null
			});
			showModal = false;
			await invalidateAll();
		} catch (error) {
			reportError(error);
		}
	};
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (showModal = false)}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">
			{goal.orderNumber}
			{goal.title} — Top priority
		</h3>
		<form
			class="flex flex-col gap-3 py-4"
			onsubmit={(event) => {
				event.preventDefault();
				handleSave();
			}}
		>
			<input
				class="input w-full"
				placeholder="Top priority"
				aria-label="Top priority"
				bind:value={text}
			/>
			<label class="flex items-center gap-2">
				<span class="whitespace-nowrap">by</span>
				<input
					type="date"
					class="input w-full"
					aria-label="Check-in date"
					bind:value={checkInDate}
				/>
			</label>
			<textarea
				class="textarea w-full"
				placeholder="Description: what's the highest priority thing for the next week or month for this goal?"
				aria-label="Priority description"
				bind:value={description}></textarea>
			{#if priority?.id}
				<textarea
					class="textarea w-full"
					placeholder="Reflection (optional)"
					aria-label="Priority reflection"
					bind:value={reflection}></textarea>
			{/if}
		</form>
		<div class="modal-action">
			{#if priority?.id}
				<button class="btn btn-error mr-auto" onclick={handleClear}>Clear</button>
				<button class="btn btn-secondary" onclick={handleComplete}>Complete</button>
			{/if}
			<button class="btn" onclick={() => (showModal = false)}>Cancel</button>
			<button class="btn btn-primary" disabled={!text.trim()} onclick={handleSave}>Save</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
