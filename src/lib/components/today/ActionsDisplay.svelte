<script lang="ts">
	import { trpc } from '$src/lib/trpc/client';
	import { goalColorForIntention, lightenHSL, localeCurrentDate } from '$src/lib/utils';
	import type { UpdateResult } from 'kysely';
	import { SvelteMap } from 'svelte/reactivity';
	import { dndzone, setKeyboardDragTrigger } from 'svelte-dnd-action';
	import Menu from 'virtual:icons/lucide/menu';
	import type { PageServerData } from '../../../routes/today/$types';
	import IntentionsModal from './IntentionsModal.svelte';
	// Space toggles the focused intention's checkbox; leave keyboard drag on Enter
	setKeyboardDragTrigger('enter');

	let {
		goals,
		intentions = $bindable(),
		handleUpdateSingleIntention
	}: {
		goals: PageServerData['goals'];
		intentions: PageServerData['intentions'];
		handleUpdateSingleIntention: (
			intention: PageServerData['intentions'][0]
		) => Promise<UpdateResult | undefined>;
	} = $props();

	type Intention = PageServerData['intentions'][0];

	let showMousoverMenu = $state(false);
	let showMousoverIndex = $state<number | null>(null);
	let showIntentionModal = $state(false);

	let goalOrderNumbers = new SvelteMap<number, number>();

	function updateGoalOrderNumbers() {
		goalOrderNumbers.clear();
		for (const goal of goals) {
			if (goal.id !== null) {
				goalOrderNumbers.set(goal.id, goal.orderNumber);
			}
		}
	}

	$effect(() => {
		if (goals) updateGoalOrderNumbers();
	});

	$effect(() => {
		if (intentions && goalOrderNumbers) {
			const known = intentions.filter((intention) => {
				const orderNumber = goalOrderNumbers.get(intention.goalId);
				return (
					intention.goalId !== -1 &&
					intention !== undefined &&
					intention.goalId !== null &&
					orderNumber !== undefined &&
					orderNumber !== -1
				);
			});
			// only reassign when something was dropped; a fresh array every run would
			// re-trigger this effect through the bound state
			if (known.length !== intentions.length) {
				intentions = known;
			}
		}
	});

	let firstIncompleteIntentionIndex = $derived(
		intentions.findIndex((intention) => intention.completed === 0)
	);

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
		return lightenHSL(goalColor, 0.2);
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
		if ((event.target as HTMLElement).closest('dialog, input, textarea, button')) return;
		if (event.key === ' ') {
			event.preventDefault();
			const checkbox = event.currentTarget.parentElement?.querySelector(
				'input[type="checkbox"]'
			) as HTMLInputElement;
			// click() toggles and fires 'change' so updateIntention persists
			checkbox.click();
		}
	};
</script>

<div class="rounded-box bg-base-100 shadow-sm">
	<div class="flex flex-col gap-1.5">
		{#if intentions.length > 0}
			<div class="mb-5 flex flex-wrap gap-x-5 pl-12">
				<h2 class="text-2xl font-bold text-gray-700 tabular-nums dark:text-purple-200">
					{intentions.length}
					{intentions.length === 1 ? 'intention' : 'intentions'} for today,
				</h2>
				<h2 class="text-base-content/60 text-2xl font-bold tabular-nums">
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
			</div>
		{/if}
		<section
			role="list"
			class="overflow-hidden"
			use:dndzone={{ items: intentions }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
		>
			{#each intentions as intention, index (intention.id)}
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
					onfocusin={() => {
						showMousoverMenu = true;
						showMousoverIndex = intention.id;
					}}
					onfocusout={(event) => {
						if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
						showMousoverMenu = false;
						showMousoverIndex = null;
					}}
				>
					{#if showMousoverMenu && showMousoverIndex === intention.id}
						{#if showIntentionModal}
							<IntentionsModal bind:opened={showIntentionModal} {intention} {goals} />
						{/if}
						<button
							aria-haspopup="dialog"
							aria-label="Open intention menu"
							class="hover:bg-base-300 cursor-pointer py-0.5"
							onclick={() => {
								showIntentionModal = true;
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
						<Menu class="w-5" color="grey" aria-hidden="true" />
					{:else}
						<div class="w-9"></div>
					{/if}
					<input
						tabindex={-1}
						id="intention-{intention.id}"
						aria-labelledby="intention-text-{intention.id}"
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
						id="intention-text-{intention.id}"
						aria-haspopup="dialog"
						oncontextmenu={(e) => {
							e.preventDefault();
							showIntentionModal = true;
						}}
						onkeydown={(e) => {
							handleButtonPressIntention(e);
							if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
								e.preventDefault();
								showIntentionModal = true;
							}
						}}
						class="goal-text ml-2 font-bold {index === firstIncompleteIntentionIndex
							? 'text-xl'
							: 'text-lg'}"
						style="--goal-color: {intention.completed
							? lighterGoalColorForIntention(goalColorForIntention(intention, goals))
							: goalColorForIntention(intention, goals)}"
						>{goalOrderNumbers.get(intention.goalId)}{intention.subIntentionQualifier ?? ''}) {intention.text}</span
					>
				</span>
			{/each}
		</section>
	</div>
</div>
