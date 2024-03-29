<script lang="ts">
	import { page } from '$app/stores';
	import GoalBoxComponent from '$src/lib/components/goals/GoalBox.svelte';
	import NewGoalBoxComponent from '$src/lib/components/goals/NewGoalBox.svelte';
	import { trpc } from '$src/lib/trpc/client';
	import type { GoalLog } from '$src/lib/trpc/types';
	import { Button, Title } from '@svelteuidev/core';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import type { PageServerData } from './$types';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

	export let data: PageServerData;
	type Goals = (typeof data.goals)[0];
	$: noGoals = data.goals.length === 0;

	// do not allow Save if goal does not have title
	$: saveButtonEnabled = data.goals.every((goal) => goal.title.length > 0);

	let dragDisabled = true; // false when renumber button has been clicked
	let dragButtonEnabled = true; // controls disabled state of renumber button
	let editButtonActive = false; // true when edit button has been clicked
	let editButtonEnabled = true; // controls disabled state of edit button
	$: editButtonEnabled = dragDisabled;
	$: dragButtonEnabled = !editButtonActive;

	// Store backup goal values which will be restored if the user cancels
	let backupGoals: Goals[] = [];
	let addedGoal = false;
	$: {
		// If a new goal has been added, set edit mode
		// This may be against the user's expectations as the goal will stay even when they cancel
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
			// Save button has been clicked
			// Update colors on screen via reassignment
			data.goals = data.goals.map((goal) => {
				return { ...goal, color: goal.color };
			});

			trpc($page).goals.updateGoals.mutate({ goals: data.goals });
		} else {
			// Edit button has been clicked
			// map forces reassignment
			backupGoals = data.goals.map((goal) => {
				return { ...goal };
			});
		}
		editButtonActive = !editButtonActive;
	}
	function handleCancelButtonClick() {
		/*
		Check if any have goals have been deleted since the edit button was clicked;
		if so, remove them from backupGoals as well
		*/
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

	// DnD
	function handleRenumberButtonClick() {
		dragDisabled = !dragDisabled;
	}
	// eslint-disable-next-line no-undef
	const handleDndConsider = (event: CustomEvent<DndEvent<Goals>>) => {
		data.goals = event.detail.items;
	};
	// eslint-disable-next-line no-undef
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Goals>>) => {
		const items: Goals[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index + 1 };
		});
		data.goals = items;

		await trpc($page).goals.updateGoals.mutate({ goals: items });
	};

	/* 
		So that the inactive goals are sorted by the date they were archived,
		we need to get the date of the last log for each goal and update the inactive goals array
	*/
	async function sortInactiveGoals() {
		const allInactiveGoals = data.inactiveGoals;
		const goalDateMap = new Map<number, string>();
		for (const iGoal of allInactiveGoals) {
			if (!iGoal.id) continue;
			const goalLogForGoalId = data.goalLogs.filter((log) => log.goalId === iGoal.id);
			// typing hack
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
	<Title class="flex">
		Goals
		<div class="daisy-indicator">
			<span
				class={editButtonActive
					? 'daisy-badge daisy-indicator-item daisy-badge-secondary translate-x-1/4'
					: ''}
			/>
			{#if editButtonActive}
				<Button color="teal" class={'mx-2'} on:click={handleCancelButtonClick}>Cancel</Button>
			{/if}
			<Button
				class={'mx-2'}
				disabled={!editButtonEnabled || !saveButtonEnabled || noGoals}
				color={!editButtonEnabled ? 'gray' : 'blue'}
				on:click={handleEditButtonClick}
			>
				{editButtonActive ? 'Save' : 'Edit'}
			</Button>
		</div>
		<div class="daisy-indicator">
			<span
				class={dragDisabled
					? ''
					: 'daisy-badge daisy-indicator-item daisy-badge-secondary translate-x-1/4'}
			/>
			<Button
				class={'mx-2'}
				disabled={!dragButtonEnabled || noGoals}
				color={!dragButtonEnabled ? 'gray' : 'blue'}
				on:click={handleRenumberButtonClick}
			>
				{dragDisabled ? 'Enable renumber goals' : 'Disable renumber goals'}
			</Button>
		</div>
	</Title>
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
		<Title>Inactive Goals</Title>
		<section role="list" id="goals-list-container" class="mt-2.5 grid gap-2.5 overflow-hidden">
			{#each data.inactiveGoals as goal (goal)}
				<GoalBoxComponent bind:goal currentlyEditing={editButtonActive} isInactiveGoal={true} />
			{/each}
		</section>
	{/if}
</div>
