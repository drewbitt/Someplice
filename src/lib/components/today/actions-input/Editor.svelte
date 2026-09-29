<script lang="ts">
	import { onMount } from 'svelte';
	import './Editor.css';

	let { highlight, value = $bindable() }: { highlight: (value: string) => string; value: string } =
		$props();

	let input: HTMLTextAreaElement;
	// During IME composition the value updates are intermediate; rewriting the
	// overlay's innerHTML mid-composition corrupts the pending text.
	let composing = $state(false);

	$effect(() => {
		if (input && input.previousElementSibling && !composing) {
			const highlighted = highlight(value);
			input.previousElementSibling.innerHTML = highlighted;
		}
	});

	onMount(() => {
		input.focus();
	});

	// The highlight pre doesn't scroll on its own — mirror the textarea's
	// scrollTop or the overlay text drifts out of view past ~7 lines.
	function handleScroll() {
		const pre = input.previousElementSibling as HTMLElement | null;
		if (pre) pre.scrollTop = input.scrollTop;
	}

	function handleInput(event: Event) {
		const textarea = event.target as HTMLTextAreaElement;
		// Expand "N " only on the caret's own line: a first-match replace would
		// rewrite an earlier "N " line instead (e.g. "1) read 2" -> "1) read 2)").
		const caret = textarea.selectionStart;
		const lineStart = textarea.value.lastIndexOf('\n', caret - 1) + 1;
		const nextBreak = textarea.value.indexOf('\n', caret);
		const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak;
		const line = textarea.value.slice(lineStart, lineEnd);
		if (/^\d $/.test(line)) {
			value =
				textarea.value.slice(0, lineStart) +
				line.replace(/(\d) $/, '$1) ') +
				textarea.value.slice(lineEnd);
			textarea.value = value;
			textarea.setSelectionRange(caret + 1, caret + 1);
		}
	}
</script>

<div class="goal__editor text-base-content">
	<pre class="goal__editor__pre" aria-hidden="true"></pre>
	<textarea
		class="goal__editor__textarea rounded-field border-base-content caret-base-content border transition duration-200 ease-in-out"
		spellcheck="false"
		bind:this={input}
		bind:value
		tabindex="0"
		oninput={handleInput}
		onscroll={handleScroll}
		oncompositionstart={() => (composing = true)}
		oncompositionend={() => (composing = false)}></textarea>
</div>
