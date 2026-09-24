<script lang="ts">
	import { localeCurrentDate } from '$src/lib/utils';
	import { onMount } from 'svelte';
	import type { PageServerData } from '../../../routes/today/$types';
	import Editor from './actions-input/Editor.svelte';
	import { todaysIntentions } from '$src/lib/stores/todaysIntentions';

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

	let intentionsString = $state('');
	let intentionsStringInitialized = $state(false);

	onMount(() => {
		if (todaysIntentions.current && todaysIntentions.current.trim() !== '') {
			intentionsString = todaysIntentions.current;
		} else {
			intentionsString = intentions
				.map((intention: Intention) => {
					return `${intention.goalId}${intention.subIntentionQualifier || ''}) ${
						intention.text
					}`.trim();
				})
				.join('\n');
		}
		intentionsStringInitialized = true;
	});

	// Persist the draft to the store — including a cleared value, so wiping the
	// editor does not resurrect old intentions on the next load.
	$effect(() => {
		if (intentionsStringInitialized) {
			todaysIntentions.current = intentionsString;
		}
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
				completed: 0,
				subIntentionQualifier: subIntention,
				text: text,
				date: localeCurrentDate().toISOString()
			};
		}
		return null;
	}

	const highlight = (value: string) => {
		// Match lines that start with a number followed by a letter or letters and a closing parenthesis
		// Don't match when the parenthesis is followed by a letter/number without a space in between
		const regex = /^[0-9](?:[a-zA-Z]{1,3})?\)(?![a-zA-Z0-9]).*$/g;
		const lines = value.split('\n');
		const highlightedLines = lines.map((line) => {
			const matches = line.match(regex);
			if (matches) {
				// Determine color from matched number
				const number = parseInt(matches[0].slice(0, -1));
				// Check goal for color
				const goal = goals.find((goal: Goal) => goal.orderNumber === number);
				if (goal) {
					return `<span class="goal__editor__span" style="color: ${goal.color}">${line}</span>`;
				}
				// If no goal matches, add a dashed underline
				return `<span class="border-b-2 border-dashed border-blue-600">${line}</span>`;
			}
			return line;
		});
		return highlightedLines.join('\n');
	};
</script>

<Editor {highlight} bind:value={intentionsString} />
