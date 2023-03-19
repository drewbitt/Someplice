<script lang="ts">
	import { page } from '$app/stores';
	import { Paper, Stack } from '@svelteuidev/core';
	import type { PageServerData } from '../../../routes/today/$types';
	import Menu from '~icons/lucide/menu';
	import { goalColorForIntention, goalOrderNumberForId, lighterHSLColor } from '$src/lib/utils';
	import IntentionsModal from './IntentionsModal.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import { trpc } from '$src/lib/trpc/client';

	export let goals: PageServerData['goals'];
	export let intentions: PageServerData['intentions'];
	type Intention = (typeof intentions)[0];

	export let handleUpdateSingleIntention: (intentions: Intention) => Promise<any>;
	let showMousoverMenu = false;
	let showMousoverIndex: number | null = null;
	let showIntentionModal = false;

	// filter intentions to make sure no errors are present (e.g. no goal id)
	$: intentions = intentions?.filter(
		(intention) => intention.goalId !== -1 && intention !== undefined && intention.goalId !== null
	);

	const updateIntention = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		const intentionId = target.dataset.id;
		if (intentionId) {
			let intention = intentions.find((intention) => {
				return intention.id === parseInt(intentionId);
			});
			if (intention) {
				intention = { ...intention, completed: target.checked ? 1 : 0 };
				const updatedIntention = await handleUpdateSingleIntention(intention);
				if (updatedIntention.length > 0) {
					intentions = intentions.map((intention) => {
						if (intention.id === parseInt(intentionId)) {
							intention.completed = target.checked ? 1 : 0;
						}
						return intention;
					});
				}
			}
		}
	};

	const lighterGoalColorForIntention = (goalColor: string) => {
		if (goalColor === 'black') {
			return 'grey';
		}
		return lighterHSLColor(goalColor);
	};

	const handleDndConsider = (event: CustomEvent<DndEvent<Intention>>) => {
		intentions = event.detail.items;
	};
	const handleDndFinalize = async (event: CustomEvent<DndEvent<Intention>>) => {
		const items: Intention[] = event.detail.items.map((item, index) => {
			return { ...item, orderNumber: index + 1 };
		});
		console.log(
			'🚀 ~ file: ActionsDisplay.svelte:61 ~ constitems:Intention[]=event.detail.items.map ~ items:',
			items
		);
		intentions = items;
		await trpc($page).intentions.updateIntentions.mutate({ intentions: items });
	};
</script>

<Paper shadow="sm">
	<Stack class="gap-1.5">
		<section
			class="overflow-hidden"
			use:dndzone={{ items: intentions }}
			on:consider={handleDndConsider}
			on:finalize={handleDndFinalize}
		>
			{#each intentions as intention, index (intention)}
				<span
					class={'pl-3 flex items-center' + (Boolean(intention.completed) ? ' line-through' : '')}
					on:mouseover={() => {
						showMousoverMenu = true;
						showMousoverIndex = intention.id;
					}}
					on:focus={() => {
						showMousoverMenu = true;
						showMousoverIndex = intention.id;
					}}
					on:blur={() => {
						showMousoverMenu = false;
						showMousoverIndex = null;
					}}
				>
					{#if showMousoverMenu && showMousoverIndex === intention.id}
						{#if showIntentionModal}
							<IntentionsModal bind:opened={showIntentionModal} {intention} {goals} />
						{/if}
						<span
							class="hover:bg-gray-400 cursor-pointer py-0.5"
							on:click={() => {
								showIntentionModal = true;
							}}
							on:keydown={(event) => {
								if (event.key === 'Enter') {
									showIntentionModal = true;
								}
							}}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"
								><g
									fill="none"
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									><circle cx="8" cy="2.5" r=".75" /><circle cx="8" cy="8" r=".75" /><circle
										cx="8"
										cy="13.5"
										r=".75"
									/></g
								></svg
							>
						</span>
						<Menu class="w-5" color="grey" />
					{:else}
						<div class="w-9" />
					{/if}
					<input
						data-id={intention.id}
						type="checkbox"
						class={index === 0 ? 'daisy-checkbox-md' : 'daisy-checkbox-sm ml-0.5'}
						checked={Boolean(intention.completed)}
						on:change={updateIntention}
					/>
					<span
						on:contextmenu={(e) => {
							e.preventDefault();
							showIntentionModal = true;
						}}
						class="ml-2 font-bold {index === 0 ? 'text-xl' : 'text-lg'}"
						style="color: {Boolean(intention.completed)
							? lighterGoalColorForIntention(goalColorForIntention(intention, goals))
							: goalColorForIntention(intention, goals)}"
						>{goalOrderNumberForId(intention.goalId, goals)}) {intention.text}</span
					>
				</span>
			{/each}
		</section>
	</Stack>
</Paper>
