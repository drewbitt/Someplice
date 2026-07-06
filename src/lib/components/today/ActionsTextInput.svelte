<script lang="ts">
	import { localeCurrentDate } from '$src/lib/utils';
	import { onMount } from 'svelte';
	import type { PageServerData } from '../../../routes/today/$types';
	import Editor from './actions-input/Editor.svelte';
	import { todaysIntentionsStore } from '$src/lib/stores/localStorage';

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

	let intentionsString = '';

	onMount(() => {
		todaysIntentionsStore.initialize();

		if ($todaysIntentionsStore && $todaysIntentionsStore.trim() !== '') {
			intentionsString = $todaysIntentionsStore;
		} else {
			intentionsString = intentions
				.map((intention: Intention) => {
					return `${intention.goalId}${intention.subIntentionQualifier || ''}) ${
						intention.text
					}`.trim();
				})
				.join('\n');
		}
	});

	$effect(() => {
		if (intentionsString) {
			todaysIntentionsStore.updateValue(intentionsString);
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

	let maxOrderNumber = 0;
	if (existingIntentions) {
		maxOrderNumber = Math.max(...existingIntentions.map((intention) => intention.orderNumber));
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
