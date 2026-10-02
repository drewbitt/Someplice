<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import GoalBoxComponent from '#lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '#lib/components/goals/NewGoalBox.svelte';
	import { goalPageErrorStore } from '#lib/stores/errors.svelte.js';
	import { trpc } from '#lib/trpc/client.js';
	import type { GoalLog } from '#lib/trpc/types.js';
	import { dndzone } from 'svelte-dnd-action';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
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
		// editor stale after Add/Archive/Delete (which invalidateAll themselves).
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
	let saveButtonEnabled = $derived(goals.every((goal) => goal.title.length > 0));

	let dragDisabled = $state(true);
	let editButtonActive = $state(false);
	let editButtonEnabled = $derived(dragDisabled);
	let dragButtonEnabled = $derived(!editButtonActive);

	let backupGoals: Goals[] = [];
	let addedGoal = $state(false);
	$effect(() => {
		if (addedGoal) {
			addedGoal = false;
			backupGoals = goals.map((goal) => {
				return { ...goal };
			});
			editButtonActive = true;
			// Entering edit mode while renumber mode is on left the New Goal
			// button dead: edits stayed hidden until the user toggled Renumber.
			dragDisabled = true;
		}
	});

	async function handleEditButtonClick() {
		if (editButtonActive) {
			goals = goals.map((goal) => {
				return { ...goal, color: goal.color };
			});

			try {
				await trpc().goals.updateGoals.mutate({ goals });
				await invalidateAll();
			} catch (error) {
				if (error instanceof Error) {
					goalPageErrorStore.setError(error.message);
				}
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
			await invalidateAll();
		} catch (error) {
			if (error instanceof Error) {
				goalPageErrorStore.setError(error.message);
			}
		}
	};

	async function sortInactiveGoals() {
		// untrack: reading inactiveGoals here while the effect writes it would
		// otherwise make the sort effect re-trigger itself.
		const allInactiveGoals = [...untrack(() => inactiveGoals)];
		const goalDateMap = new SvelteMap<number, string>();
		for (const iGoal of allInactiveGoals) {
			if (!iGoal.id) continue;
			const goalLogForGoalId = data.goalLogs.filter((log) => log.goalId === iGoal.id);
			type GoalLogNoId = Omit<GoalLog, 'id'>;

			const last = (goalLogForGoalId as GoalLogNoId[]).sort(
				(a: GoalLogNoId, b: GoalLogNoId) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
			)[0];
			if (last?.type === 'end' && iGoal.id) {
				goalDateMap.set(iGoal.id, last.date);
			}
		}
		allInactiveGoals.sort((a: Goals, b: Goals) => {
			if (!a.id || !b.id) return 0;
			const aValue = goalDateMap.get(a.id);
			const bValue = goalDateMap.get(b.id);
			if (!aValue || !bValue) return 0;
			return new Date(bValue).valueOf() - new Date(aValue).valueOf();
		});
		inactiveGoals = allInactiveGoals;
	}
	$effect(() => {
		// Track data.goalLogs (the sort input), not the store it writes.
		data.goalLogs;
		sortInactiveGoals();
	});
</script>

<svelte:head>
	<title>Someplice - Your Goals</title>
</svelte:head>

<div>
	<h1 class="flex flex-wrap items-center gap-y-2 text-3xl font-bold text-balance">
		Goals
		<div class="indicator">
			<span class={editButtonActive ? 'badge indicator-item badge-secondary translate-x-1/4' : ''}
			></span>
			{#if editButtonActive}
				<button class="btn mx-2" onclick={handleCancelButtonClick}>Cancel</button>
			{/if}
			<button
				class="btn mx-2"
				disabled={!editButtonEnabled || !saveButtonEnabled || noGoals}
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
				disabled={!dragButtonEnabled || noGoals}
				onclick={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</button>
		</div>
	</h1>
	<section
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
	</section>
	<!-- Inside the dndzone it became a droppable item: dragging the "+ New
	Goal" card appended a broken goal instead of opening the editor. -->
	<NewGoalBoxComponent bind:addedGoal />
	{#if goals.length > 0 || inactiveGoals.length > 0}
		<h2 class="text-3xl font-bold">Inactive Goals</h2>
		<section role="list" id="goals-list-container" class="mt-2.5 grid gap-2.5 overflow-hidden">
			{#each inactiveGoals as goal, i (goal.id)}
				<GoalBoxComponent
					bind:goal={inactiveGoals[i]}
					currentlyEditing={editButtonActive}
					isInactiveGoal={true}
				/>
			{/each}
		</section>
	{/if}
</div>
