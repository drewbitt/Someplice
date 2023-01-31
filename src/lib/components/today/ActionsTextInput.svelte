<script lang="ts">
	import Editor from './actions-input/Editor.svelte';
	import type { PageServerData } from './$types';
	import type { Goals } from '$src/lib/types/data';

	export let goals: PageServerData['goals'];

	const highlight = (value: string) => {
		const regex = /^[0-9](?:[a-zA-Z]{1,3})?\).*$/g;
		const lines = value.split('\n');
		const highlightedLines = lines.map((line) => {
			const matches = line.match(regex);
			if (matches) {
				// Determine color from matched number
				const number = parseInt(matches[0].slice(0, -1));
				// Check goal for color
				const goal = goals.find((goal: Goals) => goal.orderNumber === number);
				return `<span class="goal__editor__span" style="color: ${goal?.color}">${line}</span>`;
			}
			return line;
		});
		return highlightedLines.join('\n');
	};
</script>

<Editor {highlight} />
