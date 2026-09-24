<script lang="ts">
	import { onMount } from 'svelte';
	import './Editor.css';

	let { highlight, value = $bindable() }: { highlight: (value: string) => string; value: string } =
		$props();

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

<div class="goal__editor text-base-content">
	<pre class="goal__editor__pre" aria-hidden="true"></pre>
	<textarea
		class="goal__editor__textarea rounded-field border-base-content caret-base-content border transition duration-200 ease-in-out"
		bind:this={input}
		bind:value
		tabindex="0"
		oninput={handleInput}></textarea>
</div>
