<script lang="ts">
	import { Box, createStyles } from '@svelteuidev/core';
	import { onMount } from 'svelte';
	import './Editor.css';
	// Props
	export let highlight: (value: string) => string;
	export let value: string;

	// State
	let input: HTMLTextAreaElement;

	onMount(() => {
		input.focus();
		const highlighted = highlight(input.value);

		// Run on initial mount once (in case anything in localStorage etc), then run on input
		if (input.previousElementSibling) {
			input.previousElementSibling.innerHTML = highlighted;
		}
		input.addEventListener('input', () => {
			const highlighted = highlight(input.value);
			if (input.previousElementSibling) {
				input.previousElementSibling.innerHTML = highlighted;
			}
		});
	});

	const useStyles = createStyles((theme: any) => ({
		root: {
			color: theme.fn.themeColor('gray', 9),
			darkMode: {
				color: theme.fn.themeColor('gray', 3)
			}
		},
		textarea: {
			caretColor: 'black', // light mode caret color as default
			darkMode: {
				caretColor: 'white' // dark mode caret color
			}
		}
	}));

	$: ({ cx, classes, getStyles } = useStyles());
</script>

<Box class={cx('goal__editor form-control', getStyles())}>
	<pre class="goal__editor__pre" aria-hidden="true" />
	<textarea
		class={cx(
			'goal__editor__textarea rounded-btn border-base-content border transition duration-200 ease-in-out',
			classes.textarea
		)}
		bind:this={input}
		contenteditable="true"
		bind:value
		tabindex="0"
	/>
</Box>
