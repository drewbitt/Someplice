<script lang="ts">
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import type { GoalLog } from '$src/lib/trpc/types';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PageServerData } from './$types';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

	export let data: PageServerData;
	type Goals = (typeof data.goals)[0];
	$: noGoals = data.goals.length === 0;

	// do not allow Save if goal does not have title
	$: saveButtonEnabled = data.goals.every((goal) => goal.title.length > 0);

	let dragDisabled = true;
	let dragButtonEnabled = true;
	let editButtonActive = false;
	let editButtonEnabled = true;
	$: editButtonEnabled = dragDisabled;
	$: dragButtonEnabled = !editButtonActive;

	let backupGoals: Goals[] = [];
	let addedGoal = false;
	$: {
		if (addedGoal) {
			addedGoal = false;
			backupGoals = data.goals.map((goal) => {
				return { ...goal };
			});
			editButtonActive = true;
		}
	}

	function handleEditButtonClick() {
		if (editButtonActive) {
			data.goals = data.goals.map((goal) => {
				return { ...goal, color: goal.color };
			});

			trpc().goals.updateGoals.mutate({ goals: data.goals });
		} else {
			backupGoals = data.goals.map((goal) => {
				return { ...goal };
			});
		}
		editButtonActive = !editButtonActive;
	}
	function handleCancelButtonClick() {
		const deletedGoals = backupGoals.filter((goal) => {
			return !data.goals.some((goal2) => goal2.id === goal.id);
		});
		if (deletedGoals.length > 0) {
			backupGoals = backupGoals.filter((goal) => {
				return !deletedGoals.some((goal2) => goal2.id === goal.id);
			});
		} else {
			data.goals = backupGoals;
		}
		editButtonActive = false;
	}

	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}
	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index + 1 };
		});
		data.goals = items;

		await trpc().goals.updateGoals.mutate({ goals: items });
	};

	async function sortInactiveGoals() {
		const allInactiveGoals = data.inactiveGoals;
		const goalDateMap = new SvelteMap<number, string>();
		for (const iGoal of allInactiveGoals) {
			if (!iGoal.id) continue;
			const goalLogForGoalId = data.goalLogs.filter((log) => log.goalId === iGoal.id);
			type GoalLogNoId = Omit<GoalLog, 'id'>;

			const last = goalLogForGoalId.sort(
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
		data.inactiveGoals = allInactiveGoals;
	}
	$: sortInactiveGoals();
</script>

<svelte:head>
	<title>Someplice - Your Goals</title>
</svelte:head>

<div>
	<h1 class="flex text-3xl font-bold">
		Goals
		<div class=" indicator">
			<span
				class={editButtonActive
					? ' badge  indicator-item  badge-secondary translate-x-1/4'
					: ''}
			/>
			{#if editButtonActive}
				<button class=" btn mx-2" on:click={handleCancelButtonClick}>Cancel</button>
			{/if}
			<button
				class=" btn mx-2"
				disabled={!editButtonEnabled || !saveButtonEnabled || noGoals}
				on:click={handleEditButtonClick}
			>
				{editButtonActive ? 'Save' : 'Edit'}
			</button>
		</div>
		<div class=" indicator">
			<span
				class={dragDisabled
					? ''
					: ' badge  indicator-item  badge-secondary translate-x-1/4'}
			/>
			<button
				class=" btn mx-2"
				disabled={!dragButtonEnabled || noGoals}
				on:click={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</button>
		</div>
	</h1>
	<section
		role="list"
		id="goals-list-container"
		class="mt-2.5 grid gap-2.5 overflow-hidden"
		use:dndzone={{ items: data.goals, dragDisabled }}
		on:consider={handleDndConsider}
		on:finalize={handleDndFinalize}
	>
		{#each data.goals as goal (goal)}
			<GoalBoxComponent bind:goal currentlyEditing={editButtonActive} />
		{/each}
		<NewGoalBoxComponent bind:addedGoal />
	</section>
	{#if data.goals.length > 0 || data.inactiveGoals.length > 0}
		<h1 class="text-3xl font-bold">Inactive Goals</h1>
		<section role="list" id="goals-list-container" class="mt-2.5 grid gap-2.5 overflow-hidden">
			{#each data.inactiveGoals as goal (goal)}
				<GoalBoxComponent bind:goal currentlyEditing={editButtonActive} isInactiveGoal={true} />
			{/each}
		</section>
	{/if}
</div>
