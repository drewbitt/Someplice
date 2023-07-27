<script lang="ts">
	import { Box } from '@svelteuidev/core';
	import { onMount } from 'svelte';
	import './Editor.css';
	// Props
	export let highlight: (value: string) => string;
	export let value: string;

	// State
	let input: HTMLTextAreaElement;

	onMount(() => {
		input.focus();
		input.addEventListener('input', () => {
			const highlighted = highlight(input.value);
			if (input.previousElementSibling) {
				input.previousElementSibling.innerHTML = highlighted;
			}
		});
	});
</script>

<Box class="goal__editor form-control">
	<pre class="goal__editor__pre" aria-hidden="true" />
	<textarea
		class="goal__editor__textarea rounded-btn border border-base-content transition duration-200 ease-in-out"
		contenteditable="true"
		bind:this={input}
		bind:value
		tabindex="0"
	/>
</Box>
