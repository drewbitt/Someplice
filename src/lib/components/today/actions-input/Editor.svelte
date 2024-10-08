<script lang="ts">
	import { Box, createStyles } from '@svelteuidev/core';
	import { onMount } from 'svelte';
	import './Editor.css';
	// Props
	export let highlight: (value: string) => string;
	export let value: string;

	// State
	let input: HTMLTextAreaElement;

	// Reactive statement to watch for changes in the value prop and highlight
	// value comes from the parent and the textarea is also bound to it
	$: {
		if (input && input.previousElementSibling) {
			const highlighted = highlight(value);
			input.previousElementSibling.innerHTML = highlighted;
		}
	}

	onMount(() => {
		input.focus();
	});

	function handleInput(event: Event) {
		const textarea = event.target as HTMLTextAreaElement;
		if (textarea.value.match(/^\d $/m)) {
			// If the value ends with a number and space
			value = textarea.value.replace(/(\d) $/, '$1) '); // This will update the Svelte-bound value
			textarea.value = value; // Reflect the change in the actual textarea
		}
	}

	interface Theme {
		fn: {
			themeColor: (color: string, shade: number) => string;
		};
		// [key: string]: any;
	}

	const useStyles = createStyles((theme: Theme) => ({
		root: {
			color: theme.fn.themeColor('gray', 9),
			darkMode: {
				color: theme.fn.themeColor('gray', 3)
			}
		},
		textarea: {
			caretColor: 'black', // light mode caret color as default
			darkMode: {
				caretColor: 'white'
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
		on:input={handleInput}
	/>
</Box>
