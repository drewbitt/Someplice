<script>
	import HeaderContent from '#lib/components/HeaderContent.svelte';
	import '../app.css';
	import theme from '#lib/stores/theme.js';
	import { appTimeZone } from '#lib/stores/timezone.svelte.js';
	import { refreshAll } from '$app/navigation';
	import { trpc } from '#lib/trpc/client.js';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children, data } = $props();

	// One zone for every day boundary, server and client: the layout load
	// resolves the stored setting and first visits persist the browser's zone.
	$effect.pre(() => {
		if (data.timeZone) appTimeZone.set(data.timeZone);
	});
	onMount(() => {
		trpc()
			.settings.ensureTimeZone.mutate({
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})
			.then(async (zone) => {
				appTimeZone.set(zone);
				// A fresh install's first load fetched its data under the UTC
				// fallback — re-run the loads so the detected zone applies.
				if (zone !== data.timeZone) await refreshAll();
			})
			.catch(() => {
				// auto-detect is best-effort; the stored/env zone still applies
			});
	});

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', theme.current);
			document
				.querySelector('meta[name="theme-color"]')
				?.setAttribute(
					'content',
					theme.current === 'dark' ? 'oklch(25.33% 0.016 252.42)' : '#ffffff'
				);
		}
	});

	function toggleTheme() {
		theme.current = theme.current === 'dark' ? 'light' : 'dark';
	}
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html webManifestLink}
</svelte:head>

<a
	href="#main"
	class="bg-base-100 sr-only z-100 p-2 focus:not-sr-only focus:absolute focus:top-0 focus:left-0"
	>Skip to content</a
>
<div class="bg-base-100 min-h-dvh">
	<header class="bg-base-100 sticky top-0 z-50 flex h-14 items-center shadow-sm">
		<HeaderContent {toggleTheme} />
	</header>
	<main id="main" class="mx-auto max-w-screen-2xl p-4">
		{@render children()}
	</main>
</div>
