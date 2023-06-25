<script lang="ts">
	import { page } from '$app/stores';
	import { trpc } from '$src/lib/trpc/client';
	import {
		goalColorForIntention,
		goalOrderNumberForId,
		lighterHSLColor,
		localeCurrentDate
	} from '$src/lib/utils';
	import { createStyles, Paper, Stack, Title } from '@svelteuidev/core';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import Menu from '~icons/lucide/menu';
	import type { PageServerData } from '../../../routes/today/$types';
	import IntentionsModal from './IntentionsModal.svelte';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

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
	$: firstIncompleteIntentionIndex = intentions.findIndex((intention) => intention.completed === 0);

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
		intentions = items;
		await trpc($page).intentions.updateIntentions.mutate({ intentions: items });
	};
	const handleButtonPressIntention = (
		event: KeyboardEvent & {
			currentTarget: EventTarget & HTMLSpanElement;
		}
	) => {
		if (event.key === ' ') {
			const checkbox = event.currentTarget.querySelector(
				'input[type="checkbox"]'
			) as HTMLInputElement;
			checkbox.checked = !checkbox.checked;
			// TODO: Focus issue here, if you check and uncheck the checkbox, the focus is lost
		}
	};

	const darkModeStyles = createStyles((theme: any) => ({
		intentionsNumber: {
			darkMode: {
				color: theme.fn.themeColor('grape', 1) + ' !important'
			}
		},
		intentionsDate: {
			darkMode: {
				color: theme.fn.themeColor('gray', 8) + ' !important'
			}
		}
	}));
	$: ({ classes } = darkModeStyles());
</script>

<Paper shadow="sm">
	<Stack class="gap-1.5">
		{#if intentions.length > 0}
			<span class="flex pl-12 mb-5">
				<Title order={2} class="{classes.intentionsNumber} font-bold text-gray-700"
					>{intentions.length} intentions for today,</Title
				>
				<Title order={2} class="{classes.intentionsDate} ml-5 font-bold text-gray-300">
					{localeCurrentDate().toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'short',
						day: 'numeric'
					})}
				</Title>
			</span>
		{/if}
		<section
			class="overflow-hidden"
			use:dndzone={{ items: intentions }}
			on:consider={handleDndConsider}
			on:finalize={handleDndFinalize}
		>
			{#each intentions as intention, index (intention)}
				<span
					data-id={intention.id}
					class={'pl-3 flex items-center' +
						(intention.completed ? ' line-through' : '') +
						(index === firstIncompleteIntentionIndex ? ' mb-1' : '')}
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
					on:keydown={(event) => {
						handleButtonPressIntention(event);
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
						tabindex={-1}
						data-id={intention.id}
						type="checkbox"
						class={index === firstIncompleteIntentionIndex
							? 'daisy-checkbox-md'
							: 'daisy-checkbox-sm ml-0.5'}
						checked={Boolean(intention.completed)}
						on:change={updateIntention}
					/>
					<span
						on:contextmenu={(e) => {
							e.preventDefault();
							showIntentionModal = true;
						}}
						class="ml-2 font-bold {index === firstIncompleteIntentionIndex ? 'text-xl' : 'text-lg'}"
						style="color: {intention.completed
							? lighterGoalColorForIntention(goalColorForIntention(intention, goals))
							: goalColorForIntention(intention, goals)}"
						>{goalOrderNumberForId(intention.goalId, goals)}) {intention.text}</span
					>
				</span>
			{/each}
		</section>
	</Stack>
</Paper>
