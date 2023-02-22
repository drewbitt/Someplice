<script lang="ts">
	import Editor from './actions-input/Editor.svelte';
	import type { PageServerData } from '../../../routes/today/$types';

	export let goals: PageServerData['goals'];
	export let intentions: PageServerData['intentions'];
	type Intention = (typeof intentions)[0];
	type Goal = (typeof goals)[0];

	let intentionsString = intentions
		?.map((intention: Intention) => {
			return `${intention.goalId}${intention.subIntentionQualifier}) ${intention.text}`;
		})
		.join('\n');

	// $: intentions = intentionsString.split('\n').map((line: string) => {
	// 	const regex = /^[0-9](?:[a-zA-Z]{1,3})?\).*$/g;
	// 	const matches = line.match(regex);
	// 	if (matches) {
	// 		const number = parseInt(matches[0].slice(0, -1));
	// 		const goal = goals.find((goal: Goals) => goal.orderNumber === number);
	// 		return {
	// 			goalId: goal?.id,
	// 			subIntentionQualifier: matches[0].slice(-2, -1),
	// 			text: line.slice(matches[0].length + 1)
	// 		};
	// 	}
	// 	return {
	// 		goalId: goals[0].id,
	// 		subIntentionQualifier: '',
	// 		text: line
	// 	};
	// });

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
				return `<span class="goal__editor__span" style="color: ${goal?.color}">${line}</span>`;
			}
			return line;
		});
		return highlightedLines.join('\n');
	};
</script>

<Editor {highlight} bind:value={intentionsString} />
