<script lang="ts">
	import './Editor.css';
	import { onMount } from 'svelte';
	// Props
	export let highlight: (value: string) => string;

	// State
	let input: HTMLTextAreaElement;
	const className = 'goal__editor__textarea';
	let cssText = /* CSS */ `
	/**
	 * Reset the text fill color so that placeholder is visible
	 */
	.${className}:empty {
	-webkit-text-fill-color: inherit !important;
	}
	`;

	onMount(() => {
		input.addEventListener('input', () => {
			const highlighted = highlight(input.value);
			if (input.previousElementSibling) {
				input.previousElementSibling.innerHTML = highlighted;
			}
		});
	});
</script>

<div class="goal__editor">
	<pre class="goal__editor__pre" aria-hidden="true" />
	<textarea class={className.concat(' border border-base-content ounded-btn')} bind:this={input} />
	<style bind:innerHTML={cssText} contenteditable="false"></style>
</div>
