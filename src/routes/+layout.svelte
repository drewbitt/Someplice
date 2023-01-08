<script>
	import '../app.postcss';
	import { fns, AppShell, Header, SvelteUIProvider } from '@svelteuidev/core';
	import HeaderContent from '$lib/components/HeaderContent.svelte';

	let isDark = false;
	let opened = false;

	function toggleTheme() {
		isDark = !isDark;
	}
	function toggleOpened() {
		opened = !opened;
	}
</script>

<SvelteUIProvider class="h-screen" themeObserver={isDark ? 'dark' : 'light'}>
	<AppShell
		override={{
			main: {
				bc: isDark ? fns.themeColor('dark', 8) : fns.themeColor('gray', 0),
				color: isDark ? fns.themeColor('dark', 0) : 'black',
				ml: '0px !important'
			}
		}}
	>
		<Header
			slot="header"
			height={60}
			override={{ p: '$mdPX', bc: isDark ? fns.themeColor('dark', 7) : 'white' }}
		>
			<HeaderContent {isDark} toggle={toggleTheme} />
		</Header>

		<slot />
	</AppShell>
</SvelteUIProvider>
