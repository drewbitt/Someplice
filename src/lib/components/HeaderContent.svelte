<script lang="ts">
	import { page } from '$app/stores';
	import logo from '$lib/assets/someplice-compressed-logo-2023-01-21.svg';
	import { hotkey, useOs } from '@svelteuidev/composables';
	import { ActionIcon, Box, Group, Text, Tooltip } from '@svelteuidev/core';
	import { derived } from 'svelte/store';
	import Moon from 'virtual:icons/lucide/moon';
	import Sun from 'virtual:icons/lucide/sun-medium';
	import theme from '../stores/theme';

	const os = useOs();
	const mod = os === 'macos' ? '⌘' : 'ctrl';
	const isDark = derived(theme, ($theme) => $theme === 'dark');
	export let toggle: () => void;
</script>

<Group override={{ height: '100%', px: 20 }} position="apart">
	<Box class="flex">
		<a href="/" class="pr-5 no-underline">
			<Group>
				<img
					src={logo}
					alt="Someplice logo"
					width="35"
					height="35"
					style="transform: scale(1.8); filter: invert(39%) sepia(96%) saturate(1162%) hue-rotate(187deg) brightness(96%) contrast(87%);"
				/>
				<Text color="blue" size="xl" override={{ d: 'none', '@sm': { d: 'block' } }}>Someplice</Text
				>
			</Group>
		</a>
		<Group class="leading-3">
			<Box>
				<Box root="ul" class="daisy-menu daisy-menu-horizontal space-x-1 pt-0">
					<li>
						<a
							href="/today"
							class:daisy-active={$page.url.pathname === '/today'}
							class="rounded-md"
							class:bg-primary-focus={$page.url.pathname === '/today'}>Today</a
						>
					</li>
					<li>
						<a
							href="/goals"
							class:daisy-active={$page.url.pathname === '/goals'}
							class="rounded-md"
							class:bg-primary-focus={$page.url.pathname === '/goals'}>Goals</a
						>
					</li>
				</Box>
			</Box>
		</Group>
	</Box>
	<Tooltip label={`${mod} + J`}>
		<ActionIcon variant="default" on:click={toggle} size={30} use={[[hotkey, [['mod+J', toggle]]]]}>
			{#if $isDark}
				<Moon />
			{:else}
				<Sun />
			{/if}
		</ActionIcon>
	</Tooltip>
</Group>
