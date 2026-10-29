<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import { tick } from 'svelte';
	import { trpc } from '#lib/trpc/client.js';
	import type { Goal } from '#lib/trpc/types.js';
	import { colors } from './colors';
	import GoalColorPalette from './GoalColorPalette.svelte';
	import { goalPageErrorStore } from '#lib/stores/errors.svelte.js';

	let {
		goals,
		creating = $bindable(false),
		disabled = false,
		onstart
	}: {
		goals: Goal[];
		creating?: boolean;
		disabled?: boolean;
		onstart: () => void;
	} = $props();

	let title = $state('');
	let description = $state('');
	let goalColor = $state(colors[0]);
	let saving = $state(false);
	let error = $state('');
	let trigger = $state<HTMLButtonElement>();

	const focusTitle = (input: HTMLInputElement) => input.focus();

	function startGoal() {
		const usedColors = new Set(goals.map((goal) => goal.color));
		const availableColors = colors.filter((color) => !usedColors.has(color));
		goalColor = availableColors[Math.floor(Math.random() * availableColors.length)] ?? colors[0];
		title = '';
		description = '';
		error = '';
		onstart();
		creating = true;
	}

	async function closeDraft() {
		creating = false;
		await tick();
		trigger?.focus();
	}

	async function createGoal(event: SubmitEvent) {
		event.preventDefault();
		if (saving || !title.trim()) return;
		saving = true;
		error = '';
		try {
			await trpc().goals.add.mutate({
				title: title.trim(),
				color: goalColor,
				active: 1,
				description: description.trim() || null
			});
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not create your goal. Try again.';
			saving = false;
			return;
		}
		// Once created, close the draft even if refreshing fails: retrying the
		// mutation after a successful write would create a duplicate goal.
		try {
			await refreshAll();
		} catch {
			goalPageErrorStore.setError('Your goal was created. Reload the page to see it.');
		} finally {
			saving = false;
			await closeDraft();
		}
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (
			creating &&
			event.key === 'Escape' &&
			!event.isComposing &&
			!event.defaultPrevented &&
			!saving &&
			!document.querySelector('dialog[open]') &&
			!(event.target as HTMLElement).closest('dialog')
		) {
			event.preventDefault();
			closeDraft();
		}
	}}
/>

{#if creating}
	<form
		aria-label="New goal"
		class="border-base-300 bg-base-200 mx-5 my-4 space-y-3 rounded-lg border-l-4 p-4"
		style="border-left-color: {goalColor}"
		onsubmit={createGoal}
	>
		<h2 class="text-lg font-semibold">New goal</h2>
		<fieldset class="space-y-3" disabled={saving}>
			<label class="block">
				<span class="mb-1 block text-sm font-semibold">Goal title</span>
				<input
					use:focusTitle
					bind:value={title}
					class="goal-edit-input w-full rounded-md border-2 px-3 py-2 text-2xl"
					placeholder="What do you want to work towards?"
					autocomplete="off"
					maxlength="120"
					required
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-semibold">Description (optional)</span>
				<textarea
					bind:value={description}
					class="bg-base-100 border-base-300 w-full rounded-md border px-3 py-2"
					placeholder="What would progress look like?"
					maxlength="500"
					rows="2"></textarea>
			</label>
			<div class="flex items-center gap-2">
				<span class="text-sm font-semibold">Color</span>
				<GoalColorPalette bind:goalColor />
			</div>
		</fieldset>
		{#if error}<p role="alert" class="text-error">{error}</p>{/if}
		<div class="flex flex-wrap gap-2">
			<button type="submit" class="btn btn-primary" disabled={saving || !title.trim()}>
				{saving ? 'Creating…' : 'Create goal'}
			</button>
			<button type="button" class="btn btn-ghost" disabled={saving} onclick={closeDraft}>
				Cancel
			</button>
		</div>
	</form>
{:else}
	<button
		bind:this={trigger}
		id="new-goal-button"
		class="hover:bg-base-200 mx-5 my-2.5 flex w-[calc(100%-2.5rem)] items-center gap-4 rounded-lg px-2 py-3 text-left disabled:opacity-50"
		{disabled}
		onclick={startGoal}
	>
		<span class="w-12 font-mono text-5xl" aria-hidden="true">+</span>
		<span class="text-3xl">New Goal</span>
	</button>
{/if}
