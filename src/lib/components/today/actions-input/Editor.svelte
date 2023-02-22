<script lang="ts">
	import './Editor.css';
	import { onMount } from 'svelte';
	// Props
	export let highlight: (value: string) => string;
	export let value: string;

	// State
	let input: HTMLTextAreaElement;

	onMount(() => {
		input.addEventListener('input', () => {
			const highlighted = highlight(input.value);
			if (input.previousElementSibling) {
				input.previousElementSibling.innerHTML = highlighted;
			}
		});
	});
</script>

<div class="goal__editor form-control">
	<pre class="goal__editor__pre" aria-hidden="true" />
	<textarea
		class="goal__editor__textarea border border-base-content rounded-btn transition duration-200 ease-in-out"
		contenteditable="true"
		bind:this={input}
		bind:value
	/>
</div>
