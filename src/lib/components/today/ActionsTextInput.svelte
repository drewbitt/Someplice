<script lang="ts">
	import Editor from './actions-input/Editor.svelte';

	const highlight = (value: string) => {
		const regex = /^\d{1,2}\)/g;
		const lines = value.split('\n');
		const highlightedLines = lines.map((line) => {
			const matches = line.match(regex);
			if (matches) {
				return `<span style="color: red">${line}</span>`;
			}
			return line;
		});
		return highlightedLines.join('\n');
	};
</script>

<Editor {highlight} />
