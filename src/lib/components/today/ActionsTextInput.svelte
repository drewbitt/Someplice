<script lang="ts">
	import { localeCurrentDate } from '$src/lib/utils';
	import type { PageServerData } from '../../../routes/today/$types';
	import Editor from './actions-input/Editor.svelte';

	export let goals: PageServerData['goals'];
	export let intentions: PageServerData['intentions'];
	export let existingIntentions: PageServerData['intentions'] | undefined = undefined;

	type Intention = (typeof intentions)[0];
	type Goal = (typeof goals)[0];

	export let valid = true;

	let intentionsString = intentions
		.map((intention: Intention) => {
			return `${intention.goalId}${intention.subIntentionQualifier || ''}) ${
				intention.text
			}`.trim();
		})
		.join('\n');

	function parseLine(line: string): [number, string | null, string] | null {
		const regex = /^([1-9])([a-z]{0,3})?\)\s*(.*)/;
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

	$: intentions = intentionsString.split('\n').reduce((acc: Intention[], line, index) => {
		const parsedData = parseLine(line);
		if (parsedData) {
			const intention = buildIntention(parsedData, index);
			if (intention) {
				valid = true;
				acc.push(intention);
				return acc;
			}
		}

		valid = false; // If it reaches here, the line is invalid.
		return acc; // Return the accumulator unchanged for invalid lines.
	}, []);

	$: intentions = [...(existingIntentions || []), ...intentions];

	let maxOrderNumber = 0;
	if (existingIntentions) {
		maxOrderNumber = Math.max(...existingIntentions.map((intention) => intention.orderNumber));
	}

	const highlight = (value: string) => {
		const regex = /^[0-9](?:[a-zA-Z]{1,3})?\).*$/g;
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
				return line;
			}
			return line;
		});
		return highlightedLines.join('\n');
	};
</script>

<Editor {highlight} bind:value={intentionsString} />
