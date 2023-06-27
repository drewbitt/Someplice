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

	$: intentions = intentionsString
		.split('\n')
		.map((line: string, index) => {
			const regex = /^([1-9])([a-z]{0,3})?\)\s*(.*)/;
			const match = line.match(regex);
			if (match) {
				const [_, number, subintention, text] = match;

				const goal = goals.find((goal: Goal) => goal.orderNumber === parseInt(number));
				if (goal && goal?.id) {
					valid = true;
					const newIntention: Intention = {
						id: null,
						goalId: goal.id,
						orderNumber: index + maxOrderNumber + 1,
						completed: 0,
						subIntentionQualifier: subintention || null,
						text: text,
						date: localeCurrentDate().toISOString()
					};
					return newIntention;
				}
			}
			valid = false;
			return {
				id: null,
				goalId: -1,
				orderNumber: -1,
				completed: -1,
				subIntentionQualifier: '',
				text: line,
				date: localeCurrentDate().toISOString()
			};
		})
		.filter((intention: Intention) => intention.goalId != -1 && intention !== undefined);

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
