<script lang="ts">
	import { trpc } from '$src/lib/trpc/client';
	import { goalColorForIntention, lighterHSLColor, localeCurrentDate } from '$src/lib/utils';
	import type { UpdateResult } from 'kysely';
	import { SvelteMap } from 'svelte/reactivity';
	import { dndzone, overrideItemIdKeyNameBeforeInitialisingDndZones } from 'svelte-dnd-action';
	import Menu from 'virtual:icons/lucide/menu';
	import type { PageServerData } from '../../../routes/today/$types';
	import IntentionsModal from './IntentionsModal.svelte';
	overrideItemIdKeyNameBeforeInitialisingDndZones('orderNumber');

	let {
		goals,
		intentions = $bindable(),
		handleUpdateSingleIntention
	}: {
		goals: PageServerData['goals'];
		intentions: PageServerData['intentions'];
		handleUpdateSingleIntention: (intention: PageServerData['intentions'][0]) => Promise<UpdateResult | undefined>;
	} = $props();

	type Intention = PageServerData['intentions'][0];

	let showMousoverMenu = false;
	let showMousoverIndex: number | null = null;
	let showIntentionModal = false;

	let goalOrderNumbers = new SvelteMap<number, number>();

	function updateGoalOrderNumbers() {
		goalOrderNumbers.clear();
		for (const goal of goals) {
			if (goal.id !== null) {
				goalOrderNumbers.set(goal.id, goal.orderNumber);
			}
		}
	}

	$effect(() => { if (goals) updateGoalOrderNumbers(); });

	$effect(() => {
		if (intentions && goalOrderNumbers) {
			intentions = intentions.filter((intention) => {
				const orderNumber = goalOrderNumbers.get(intention.goalId);
				return (
					intention.goalId !== -1 &&
					intention !== undefined &&
					intention.goalId !== null &&
					orderNumber !== undefined &&
					orderNumber !== -1
				);
			});
		}
	});

	let firstIncompleteIntentionIndex = $derived(intentions.findIndex((intention) => intention.completed === 0));

	const updateIntention = async (event: Event) => {
		const target = event.target as HTMLInputElement;
		const intentionId = target.id.split('-')[1];
		if (intentionId) {
			let intention = intentions.find((intention) => {
				return intention.id === parseInt(intentionId);
			});
			if (intention) {
				intention = { ...intention, completed: target.checked ? 1 : 0 };
				const updatedIntention = await handleUpdateSingleIntention(intention);
				if (
					updatedIntention?.numUpdatedRows !== undefined &&
					updatedIntention?.numUpdatedRows > 0
				) {
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
		await trpc().intentions.updateIntentions.mutate({ intentions: items });
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
		}
	};
</script>

<div class="rounded-box bg-base-100 shadow-sm">
	<div class="flex flex-col gap-1.5">
		{#if intentions.length > 0}
			<span class="mb-5 flex pl-12">
				<h2 class="text-2xl font-bold text-gray-700 dark:text-purple-200">
					{intentions.length} intentions for today,
				</h2>
				<h2 class="ml-5 text-2xl font-bold text-gray-300 dark:text-gray-600">
					{(() => {
						const dateObj = localeCurrentDate();
						const formatter = new Intl.DateTimeFormat('en-US', {
							weekday: 'long',
							month: 'short',
							day: 'numeric',
							timeZone: 'UTC'
						});
						return formatter.format(dateObj);
					})()}
				</h2>
			</span>
		{/if}
		<section
			role="list"
			class="overflow-hidden"
			use:dndzone={{ items: intentions }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each intentions as intention, index (intention)}
				<span
					role="listitem"
					aria-label="{goalOrderNumbers.get(intention.goalId)}{intention.subIntentionQualifier ??
						''}) {intention.text}"
					class={'flex items-center pl-3' +
						(intention.completed ? ' line-through' : '') +
						(index === firstIncompleteIntentionIndex ? ' mb-1' : '')}
					onmouseover={() => {
						showMousoverMenu = true;
						showMousoverIndex = intention.id;
					}}
					onfocus={() => {
						showMousoverMenu = true;
						showMousoverIndex = intention.id;
					}}
					onblur={() => {
						showMousoverMenu = false;
						showMousoverIndex = null;
					}}
					onkeydown={(event) => {
						handleButtonPressIntention(event);
					}}
				>
					{#if showMousoverMenu && showMousoverIndex === intention.id}
						{#if showIntentionModal}
							<IntentionsModal bind:opened={showIntentionModal} {intention} {goals} />
						{/if}
						<button
							aria-haspopup="true"
							class="cursor-pointer py-0.5 hover:bg-gray-400"
							onclick={() => {
								showIntentionModal = true;
							}}
							onkeydown={(event) => {
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
						</button>
						<Menu class="w-5" color="grey" />
					{:else}
						<div class="w-9" />
					{/if}
					<input
						tabindex={-1}
						id="intention-{intention.id}"
						aria-labelledby="intention-{intention.id}"
						type="checkbox"
						class={index === firstIncompleteIntentionIndex
							? 'checkbox-md ml-0.5'
							: 'checkbox-sm ml-0.5'}
						checked={Boolean(intention.completed)}
						onchange={updateIntention}
					/>
					<span
						role="button"
						tabindex={0}
						aria-haspopup="true"
						oncontextmenu={(e) => {
							e.preventDefault();
							showIntentionModal = true;
						}}
						class="ml-2 font-bold {index === firstIncompleteIntentionIndex ? 'text-xl' : 'text-lg'}"
						style="color: {intention.completed
							? lighterGoalColorForIntention(goalColorForIntention(intention, goals))
							: goalColorForIntention(intention, goals)}"
						>{goalOrderNumbers.get(intention.goalId)}{intention.subIntentionQualifier ?? ''}) {intention.text}</span
					>
				</span>
			{/each}
		</section>
	</div>
</div>
