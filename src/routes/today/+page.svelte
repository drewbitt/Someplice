<script lang="ts">
	import { refreshAll } from '$app/navigation';
	import ActionsTextInput from '#lib/components/today/ActionsTextInput.svelte';
	import ActionsDisplay from '#lib/components/today/ActionsDisplay.svelte';
	import GoalBadges from '#lib/components/today/GoalBadges.svelte';
	import PriorityCards from '#lib/components/today/PriorityCards.svelte';
	import Review from '#lib/components/today/review-outcomes/Review.svelte';
	import { trpc } from '#lib/trpc/client.js';
	import { dateKeyInZone, dayOfWeekFromDate, goalsForJourneyDay } from '#lib/utils/index.js';
	import { appTimeZone } from '#lib/stores/timezone.svelte.js';
	import CircleX from 'virtual:icons/lucide/x-circle';
	import type { PageServerData } from './$types';
	import { todaysIntentions } from '#lib/stores/todaysIntentions.js';
	import { onMount } from 'svelte';
	import { appLogger } from '#lib/utils/app-logger.js';
	import { TRPCClientError } from '@trpc/client';

	let { data }: { data: PageServerData } = $props();
	let weekday = $derived(dayOfWeekFromDate(new Date(data.today)));
	type Intentions = (typeof data.intentions)[0];

	let intentions = $derived(data.intentions);
	let additionalIntentions = $state<Intentions[]>([]);
	let draftIntentions = $state<Intentions[]>([]);
	let validIntentions = $state<boolean>(false);
	let showValidIntentionsNotification = $state(false);
	let showAdditionalIntentionsTextArea = $state(false);
	let showDBErrorNotification = $state(false);
	let saveError = $state('Error saving intentions');
	let hasOutstandingOutcome = $derived(data.hasOutstandingOutcome);
	let saving = $state(false);
	let draft = $state(todaysIntentions.current ?? '');

	onMount(() => {
		if (todaysIntentions.current && !noGoals && !noIntentions) {
			showAdditionalIntentionsTextArea = true;
		}

		let day = data.today;
		let refreshing = false;
		const checkDay = async (force = false) => {
			const current = dateKeyInZone(appTimeZone.current);
			if (!refreshing && (force || current !== day)) {
				refreshing = true;
				try {
					await refreshAll();
					day = current;
				} catch (error) {
					appLogger.error('Error refreshing Today', error);
				} finally {
					refreshing = false;
				}
			}
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				void checkDay(true);
			}
		};
		const timer = window.setInterval(checkDay, 60_000);
		document.addEventListener('visibilitychange', onVisibilityChange);
		void checkDay();
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	let noGoals = $derived(data.goals.length === 0);
	let noIntentions = $derived(data.intentions.length === 0);
	$effect(() => {
		if (showDBErrorNotification) {
			setTimeout(() => {
				showDBErrorNotification = false;
			}, 5000);
		}
	});

	const setHasOutstandingOutcome = (value: boolean) => {
		hasOutstandingOutcome = value;
	};

	const handleSaveIntentions = async () => {
		showValidIntentionsNotification = !validIntentions;
		if (!validIntentions || saving) return;
		// Keep drafts separate until the write succeeds, so retries use the current editor.
		const payload = noIntentions ? draftIntentions : additionalIntentions;
		saving = true;
		try {
			if (payload.length > 0) {
				await trpc().intentions.updateIntentions.mutate({ intentions: payload });
			}
			todaysIntentions.current = null;
			handleHideAdditionalIntentionsTextArea();
			await refreshAll();
			draft = '';
		} catch (error) {
			appLogger.error('Error saving intentions', error);
			if (error instanceof TRPCClientError && error.data?.code === 'CONFLICT') {
				saveError = error.message;
				await refreshAll();
				showAdditionalIntentionsTextArea = true;
			} else {
				saveError = 'Error saving intentions';
			}
			showDBErrorNotification = true;
		} finally {
			saving = false;
		}
	};

	const handleShowAdditionalIntentionsTextArea = () => {
		showAdditionalIntentionsTextArea = true;
	};

	const handleHideAdditionalIntentionsTextArea = () => {
		showValidIntentionsNotification = false;
		additionalIntentions = [];
		showAdditionalIntentionsTextArea = false;
	};
</script>

<svelte:head>
	<title>Someplice - Today's Intentions</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h1 class="sr-only">Today</h1>
	<GoalBadges goals={data.goals} />
	{#if !noGoals && !hasOutstandingOutcome}
		<PriorityCards goals={data.goals} priorities={data.priorities} />
	{/if}
	{#if !(data.intentions.length > 0) && !hasOutstandingOutcome}
		<h2 class="text-xl font-bold">Actions you'll take towards your goals today</h2>
	{/if}
	{#if hasOutstandingOutcome}
		<Review intentionsOnLatestDate={data.intentionsOnLatestDate} {setHasOutstandingOutcome} />
	{:else if noGoals && noIntentions}
		<div role="alert" class="alert alert-error border-error">
			<CircleX class="size-6 shrink-0 stroke-current" />
			<span>You have no goals. Please add some goals first.</span>
		</div>
	{:else if data.intentions.length > 0}
		<ActionsDisplay
			recentIntentions={data.recentIntentions}
			today={data.today}
			bind:intentions
			goals={goalsForJourneyDay(data.goals, data.inactiveGoals, intentions)}
		/>
		{#if showAdditionalIntentionsTextArea}
			<div class="flex items-center">
				<button class="btn mr-2" onclick={handleHideAdditionalIntentionsTextArea}>Hide</button>
				<h3 class="text-lg font-bold">What else are you doing towards your goals today?</h3>
			</div>
			{#if showValidIntentionsNotification}
				<div role="alert" class="alert alert-error border-error">
					<CircleX class="size-6 shrink-0 stroke-current" />
					<span
						>Please check that your intentions are formatted correctly and have valid goal numbers.</span
					>
				</div>
			{/if}
			<ActionsTextInput
				today={data.today}
				recentIntentions={data.recentIntentions}
				goals={data.goals}
				bind:intentionsString={draft}
				bind:intentions={additionalIntentions}
				bind:valid={validIntentions}
				existingIntentions={data.intentions}
			/>
			<div>
				<button class="btn" disabled={saving} onclick={handleSaveIntentions}>
					Set {weekday} intentions
				</button>
			</div>
		{:else}
			<div>
				<button class="btn" onclick={handleShowAdditionalIntentionsTextArea}>
					Add more {weekday} intentions
				</button>
			</div>
		{/if}
	{:else}
		{#if showValidIntentionsNotification}
			<div role="alert" class="alert alert-error border-error">
				<CircleX class="size-6 shrink-0 stroke-current" />
				<span
					>Please check that your intentions are formatted correctly and have valid goal numbers.</span
				>
			</div>
		{/if}
		<ActionsTextInput
			today={data.today}
			recentIntentions={data.recentIntentions}
			goals={data.goals}
			bind:intentionsString={draft}
			bind:intentions={draftIntentions}
			bind:valid={validIntentions}
		/>

		<div>
			<button class="btn" disabled={saving} onclick={handleSaveIntentions}>
				Set {weekday} intentions
			</button>
		</div>
	{/if}

	{#if showDBErrorNotification}
		<div class="toast">
			<div class="alert alert-error">
				<span>{saveError}</span>
			</div>
		</div>
	{/if}
</div>
