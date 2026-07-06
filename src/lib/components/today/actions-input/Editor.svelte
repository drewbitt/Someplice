<script lang="ts">
	import { onMount } from 'svelte';
	import './Editor.css';

	let { highlight, value }: { highlight: (value: string) => string; value: string } = $props();

	let input: HTMLTextAreaElement;

	$effect(() => {
		if (input && input.previousElementSibling) {
			const highlighted = highlight(value);
			input.previousElementSibling.innerHTML = highlighted;
		}
	});

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
		oninput={handleInput}
	/>
</div>
