<script lang="ts">
	import { page } from '$app/stores';
	import logo from '$lib/assets/someplice-compressed-logo-2023-01-21.svg';
	import theme from '$lib/stores/theme';
	import { onMount } from 'svelte';

	export let toggleTheme: () => void;

	let os: string;
	let mod: string;

	onMount(() => {
		os = navigator.platform.includes('Mac') ? 'macos' : 'other';
		mod = os === 'macos' ? '⌘' : 'ctrl';

		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
				e.preventDefault();
				toggleTheme();
			}
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	});

	$: isDark = $theme === 'dark';
</script>

<nav class="flex h-full w-full items-center justify-between px-5">
	<div class="flex items-center gap-6">
		<a href="/" class="flex items-center gap-2 no-underline">
			<img
				src={logo}
				alt="Someplice logo"
				width="35"
				height="35"
				style="transform: scale(1.8); filter: invert(39%) sepia(96%) saturate(1162%) hue-rotate(187deg) brightness(96%) contrast(87%);"
			/>
			<span class="hidden text-xl text-blue-500 sm:block">Someplice</span>
		</a>
		<ul class=" menu  menu-horizontal flex gap-1 p-0">
			<li>
				<a
					href="/today"
					class:active={$page.url.pathname === '/today'}
					class="rounded-md"
					class:bg-primary={$page.url.pathname === '/today'}
					class:text-primary-content={$page.url.pathname === '/today'}>Today</a
				>
			</li>
			<li>
				<a
					href="/goals"
					class:active={$page.url.pathname === '/goals'}
					class="rounded-md"
					class:bg-primary={$page.url.pathname === '/goals'}
					class:text-primary-content={$page.url.pathname === '/goals'}>Goals</a
				>
			</li>
			<li>
				<a
					href="/journey"
					class:active={$page.url.pathname === '/journey'}
					class="rounded-md"
					class:bg-primary={$page.url.pathname === '/journey'}
					class:text-primary-content={$page.url.pathname === '/journey'}>Journey</a
				>
			</li>
		</ul>
	</div>
	<div class=" tooltip  tooltip-bottom" data-tip="{mod} + J">
		<button
			class=" btn  btn-ghost  btn-square"
			on:click={toggleTheme}
			aria-label="Toggle theme"
		>
			{#if isDark}
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
						x1="12"
						y1="21"
						x2="12"
						y2="23"
					/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
						x1="18.36"
						y1="18.36"
						x2="19.78"
						y2="19.78"
					/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
						x1="4.22"
						y1="19.78"
						x2="5.64"
						y2="18.36"
					/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg
				>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg
				>
			{/if}
		</button>
	</div>
</nav>
