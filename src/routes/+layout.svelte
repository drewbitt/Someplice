<script>
	import HeaderContent from '$lib/components/HeaderContent.svelte';
	import { AppShell, fns, Header, SvelteUIProvider } from '@svelteuidev/core';
	import '../app.postcss';
	import theme from '$lib/stores/theme';
	import { derived } from 'svelte/store';

	const isDark = derived(theme, ($theme) => $theme === 'dark');

	function toggleTheme() {
		theme.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
	}
</script>

<SvelteUIProvider class="h-screen" themeObserver={$isDark ? 'dark' : 'light'} withGlobalStyles>
	<AppShell
		override={{
			main: {
				bc: $isDark ? fns.themeColor('dark', 8) : fns.themeColor('gray', 0),
				color: $isDark ? fns.themeColor('dark', 0) : 'black',
				ml: '0px !important'
			}
		}}
	>
		<Header
			slot="header"
			height={60}
			override={{ p: '$mdPX', bc: $isDark ? fns.themeColor('dark', 7) : 'white' }}
		>
			<HeaderContent toggle={toggleTheme} />
		</Header>

		<slot />
	</AppShell>
</SvelteUIProvider>
