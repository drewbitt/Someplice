<script lang="ts">
	import { onMount } from 'svelte';
	import './Editor.css';

	export let highlight: (value: string) => string;
	export let value: string;

	let input: HTMLTextAreaElement;

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
			value = textarea.value.replace(/(\d) $/, '$1) ');
			textarea.value = value;
		}
	}
</script>

<div class="goal__editor form-control text-gray-900 dark:text-gray-300">
	<pre class="goal__editor__pre" aria-hidden="true" />
	<textarea
		class="goal__editor__textarea rounded-btn border-base-content caret-black border transition duration-200 ease-in-out dark:caret-white"
		bind:this={input}
		contenteditable="true"
		bind:value
		tabindex="0"
		on:input={handleInput}
	/>
</div>
