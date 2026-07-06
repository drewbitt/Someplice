<script>
	import HeaderContent from '$lib/components/HeaderContent.svelte';
	import '../app.postcss';
	import theme from '$lib/stores/theme';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', $theme);
		}
	});

	function toggleTheme() {
		theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
	}
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html webManifestLink}
</svelte:head>

<div class="min-h-screen bg-base-100">
	<header class="sticky top-0 z-50 flex h-14 items-center bg-base-100 shadow-sm">
		<HeaderContent {toggleTheme} />
	</header>
	<main class="p-4">
		{@render children()}
	</main>
</div>
