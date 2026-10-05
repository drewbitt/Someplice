<script lang="ts">
	import { wallClockInZone, goalOrderNumberForId } from '#lib/utils/index.js';
	import { appTimeZone } from '#lib/stores/timezone.svelte.js';
	import { untrack } from 'svelte';
	import type { PageServerData } from '../../../routes/today/$types';
	import Editor from './actions-input/Editor.svelte';
	import NotDonesPanel from './NotDonesPanel.svelte';
	import { todaysIntentions } from '#lib/stores/todaysIntentions.js';

	let {
		goals,
		existingIntentions,
		valid = $bindable(),
		intentions = $bindable([])
	}: {
		goals: PageServerData['goals'];
		existingIntentions?: PageServerData['intentions'];
		valid: boolean;
		intentions?: PageServerData['intentions'];
	} = $props();

	type Intention = (typeof intentions)[0];
	type Goal = (typeof goals)[0];

	let intentionsString = $state(
		untrack(
			() =>
				todaysIntentions.current ??
				intentions
					.map(
						(intention) =>
							`${goalOrderNumberForId(intention.goalId, goals)}${intention.subIntentionQualifier ?? ''}) ${intention.text}`
					)
					.join('\n')
		)
	);

	$effect(() => {
		todaysIntentions.current = intentionsString;
	});

	$effect(() => {
		intentions = intentionsString.split('\n').reduce((acc: Intention[], line, index) => {
			const parsedData = parseLine(line);
			if (parsedData) {
				const intention = buildIntention(parsedData, index);
				if (intention) {
					acc.push(intention);
					return acc;
				}
			}
			return acc;
		}, []);
	});

	$effect(() => {
		if (intentions.length === intentionsString.split('\n').filter((line) => line.trim()).length) {
			valid = true;
		} else {
			valid = false;
		}
	});

	function parseLine(line: string): [number, string | null, string] | null {
		const regex = /^([1-9])([a-z]{0,3})?\)\s*(\S.*)$/;
		const match = line.match(regex);
		if (match) {
			const [_, orderNumber, subIntention, text] = match;
			return [parseInt(orderNumber), subIntention || null, text];
		}
		return null;
	}

	let maxOrderNumber = $derived(
		existingIntentions
			? Math.max(...existingIntentions.map((intention) => intention.orderNumber), 0)
			: 0
	);

	function buildIntention(
		parsedData: [number, string | null, string],
		index: number
	): Intention | null {
		const [orderNumber, subIntention, text] = parsedData;
		const goal = goals.find((goal: Goal) => goal.orderNumber === orderNumber);
		if (goal && goal.id) {
			return {
				id: null,
				goalId: goal.id,
				orderNumber: index + maxOrderNumber + 1,
				status: 'pending',
				subIntentionQualifier: subIntention,
				text: text,
				date: wallClockInZone(appTimeZone.current).toISOString()
			};
		}
		return null;
	}

	// Everything interpolated below lands in an innerHTML write, so escape
	// text content and only allow injection-proof CSS color forms inline.
	const escapeHtml = (text: string) =>
		text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	const SAFE_CSS_COLOR = /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^[a-zA-Z]+\([^"'<>;{}\\]{1,64}\)$/;

	const highlight = (value: string) => {
		// Match lines that start with a number followed by a letter or letters and a closing parenthesis
		// Don't match when the parenthesis is followed by a letter/number without a space in between
		const regex = /^[0-9](?:[a-zA-Z]{1,3})?\)(?![a-zA-Z0-9]).*$/g;
		const lines = value.split('\n');
		const highlightedLines = lines.map((line) => {
			const matches = line.match(regex);
			const escaped = escapeHtml(line);
			if (matches) {
				// Determine color from matched number
				const number = parseInt(matches[0].slice(0, -1));
				// Check goal for color
				const goal = goals.find((goal: Goal) => goal.orderNumber === number);
				if (goal) {
					const style = SAFE_CSS_COLOR.test(goal.color)
						? ` style="--goal-color: ${goal.color}"`
						: '';
					return `<span class="goal__editor__span goal-text"${style}>${escaped}</span>`;
				}
				// If no goal matches, add a dashed underline
				return `<span class="border-b-2 border-dashed border-blue-600">${escaped}</span>`;
			}
			return escaped;
		});
		return highlightedLines.join('\n');
	};
	const appendIntentionLine = (line: string) => {
		intentionsString = intentionsString.trim() ? `${intentionsString.trimEnd()}\n${line}` : line;
	};
</script>

<div class="flex flex-col gap-2">
	<NotDonesPanel
		{goals}
		plannedIntentions={[...(existingIntentions ?? []), ...intentions]}
		onImport={appendIntentionLine}
	/>
	<Editor {highlight} bind:value={intentionsString} />
</div>
