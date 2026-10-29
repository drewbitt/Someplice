<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import GoalBoxComponent from '#lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '#lib/components/goals/NewGoalBox.svelte';
	import { goalPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { trpc } from '#lib/trpc/client.js';
	import { TRPCClientError } from '@trpc/client';
	import { dndzone } from 'svelte-dnd-action';
	import { untrack } from 'svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
	type Goals = (typeof data.goals)[0];

	// svelte-ignore state_referenced_locally
	let goals = $state(data.goals);
	// svelte-ignore state_referenced_locally
	let inactiveGoals = $state(data.inactiveGoals);
	$effect(() => {
		if (!editButtonActive) {
			goals = data.goals;
			inactiveGoals = data.inactiveGoals;
			return;
		}
		// Mid-edit: merge by id instead of replacing. A wholesale resync would
		// discard unsaved text/color edits, but skipping it entirely leaves the
		// editor stale after Add/Archive/Delete (which refreshAll themselves).
		// Keep local editable fields; adopt server adds, removals, and order.
		// untrack the local reads: the effect assigns goals/inactiveGoals, so
		// tracking them would retrigger the effect on its own writes.
		const localById = new Map(untrack(() => goals).map((goal) => [goal.id, goal]));
		goals = data.goals.map((fresh) => {
			const local = localById.get(fresh.id);
			return local
				? { ...fresh, title: local.title, description: local.description, color: local.color }
				: fresh;
		});
		inactiveGoals = data.inactiveGoals;
	});

	let noGoals = $derived(goals.length === 0);

	// do not allow Save if goal does not have title
	let saveButtonEnabled = $derived(goals.every((goal) => goal.title.trim().length > 0));

	let dragDisabled = $state(true);
	let editButtonActive = $state(false);
	let saving = $state(false);

	let backupGoals: Goals[] = [];
	let creatingGoal = $state(false);

	async function handleEditButtonClick() {
		if (saving) return;
		if (editButtonActive) {
			saving = true;
			try {
				await trpc().goals.updateGoals.mutate({ goals });
				await refreshAll();
			} catch (error) {
				goalPageErrorStore.setError(
					error instanceof Error ? error.message : 'Failed to save goals'
				);
				if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
					// Drop edit mode so stale merged fields can't overwrite the
					// other tab's changes on retry.
					editButtonActive = false;
					await refreshAll();
				}
				return;
			} finally {
				saving = false;
			}
		} else {
			backupGoals = goals.map((goal) => {
				return { ...goal };
			});
		}
		editButtonActive = !editButtonActive;
	}
	function handleCancelButtonClick() {
		const deletedGoals = backupGoals.filter((goal) => {
			return !goals.some((goal2) => goal2.id === goal.id);
		});
		if (deletedGoals.length > 0) {
			backupGoals = backupGoals.filter((goal) => {
				return !deletedGoals.some((goal2) => goal2.id === goal.id);
			});
		} else {
			goals = backupGoals;
		}
		editButtonActive = false;
	}

	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}
	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index + 1 };
		});
		goals = items;

		try {
			await trpc().goals.updateGoals.mutate({ goals: items });
			await refreshAll();
		} catch (error) {
			if (error instanceof Error) {
				goalPageErrorStore.setError(error.message);
				if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
					await refreshAll();
				}
			}
		}
	};
</script>

<svelte:head>
	<title>Someplice - Your Goals</title>
</svelte:head>

<fieldset disabled={saving} class="min-w-0" aria-label="Goals">
	<div class="flex flex-wrap items-center gap-y-2">
		<h1 class="text-3xl font-bold">Goals</h1>
		<div class="indicator">
			<span class={editButtonActive ? 'badge indicator-item badge-secondary translate-x-1/4' : ''}
			></span>
			{#if editButtonActive}
				<button class="btn mx-2" disabled={saving} onclick={handleCancelButtonClick}>Cancel</button>
			{/if}
			<button
				class="btn mx-2"
				disabled={saving ||
					creatingGoal ||
					!dragDisabled ||
					(editButtonActive && !saveButtonEnabled) ||
					(noGoals && inactiveGoals.length === 0)}
				onclick={handleEditButtonClick}
			>
				{editButtonActive ? 'Save' : 'Edit'}
			</button>
		</div>
		<div class="indicator">
			<span class={dragDisabled ? '' : 'badge indicator-item badge-secondary translate-x-1/4'}
			></span>
			<button
				class="btn mx-2"
				disabled={creatingGoal || editButtonActive || noGoals}
				onclick={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</button>
		</div>
	</div>
	<div
		role="list"
		id="goals-list-container"
		class="mt-2.5 grid gap-2.5 overflow-hidden"
		use:dndzone={{ items: goals, dragDisabled }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each goals as goal, i (goal.id)}
			<GoalBoxComponent
				bind:goal={goals[i]}
				currentlyEditing={editButtonActive}
				priority={data.priorities.find((p) => p.goalId === goal.id)}
			/>
		{/each}
	</div>
	<!-- Inside the dndzone it became a droppable item: dragging the "+ New
	Goal" card appended a broken goal instead of opening the editor. -->
	<NewGoalBoxComponent
		{goals}
		bind:creating={creatingGoal}
		disabled={editButtonActive || saving}
		onstart={() => (dragDisabled = true)}
	/>
	{#if inactiveGoals.length > 0}
		<h2 class="text-3xl font-bold">Inactive Goals</h2>
		<div role="list" id="inactive-goals-list-container" class="mt-2.5 grid gap-2.5 overflow-hidden">
			{#each inactiveGoals as goal, i (goal.id)}
				<GoalBoxComponent
					bind:goal={inactiveGoals[i]}
					currentlyEditing={editButtonActive}
					isInactiveGoal={true}
				/>
			{/each}
		</div>
	{/if}
</fieldset>
