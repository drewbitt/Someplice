<script>
	// import '../app.postcss';
	import {
		fns,
		AppShell,
		Navbar,
		Header,
		Title,
		Divider,
		SvelteUIProvider,
		Container,
		ShellSection
	} from '@svelteuidev/core';
	import HeaderContent from '$lib/components/HeaderContent.svelte';
	import { getCssText } from '@svelteuidev/core';

	let isDark = false;
	let opened = false;

	function toggleTheme() {
		isDark = !isDark;
	}
	function toggleOpened() {
		opened = !opened;
	}
</script>

<SvelteUIProvider withNormalizeCSS withGlobalStyles>
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
			<HeaderContent {isDark} {opened} toggle={toggleTheme} toggleOpen={toggleOpened} />
		</Header>

		<slot />
	</AppShell>
</SvelteUIProvider>
