<script lang="ts">
	import { browser } from '$app/environment';
	import { Box } from '@svelteuidev/core';
	import { onMount } from 'svelte';

	onMount(async () => {
		await import('./code-input/code-input')
			.then(({ codeInput }) => {
				codeInput.registerTemplate(
					'syntax-highlighted',
					codeInput.templates.custom(
						// @ts-ignore
						function (result_element: HTMLElement) {
							// result_element = <code> element

							console.log(
								'🚀 ~ file: ActionsTextInput.svelte:32 ~ .then ~ result_element',
								result_element
							);
							const content = result_element?.textContent?.toString();
							console.log('🚀 ~ file: +page.svelte:15 ~ awaitimport ~ content', content);
							const regex = /[0-9]{1,2}\)/g;

							const matches = content?.match(regex);
							console.log('🚀 ~ file: +page.svelte:20 ~ awaitimport ~ matches', matches);

							// Convert text in result_element to be wrapped with span with color. Each row is wrapped in a different span and color.
							// TOOD: Make whole row that color
							matches?.forEach((match, index) => {
								const color = `hsl(${(index * 360) / matches.length}, 100%, 50%)`;
								const span = document.createElement('span');
								span.style.color = color;
								span.textContent = match;
								result_element.innerHTML = result_element.innerHTML.replace(match, span.outerHTML);
							});
						},
						true /* Optional - Is the `pre` element styled as well as the `code` element? Changing this to false uses the code element as the scrollable one rather than the pre element */,
						false /* Optional - This is used for editing code - setting this to true overrides the Tab key and uses it for indentation */,
						false /* Optional - Setting this to true passes the `<code-input>` element as a second argument to the highlight function to be used for getting data- attribute values and using the DOM for the code-input */,
						[] // Array of plugins
					)
				);
			})
			.then(() => {
				import('./code-input/code-input.css');
			});
	});
</script>

{#if browser}
	<Box root="code-input" class="bg-white border min-w-min max-w-xl" />
{/if}
