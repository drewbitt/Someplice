<script lang="ts">
	import { Group, ActionIcon, Text, Burger, Tooltip, Box } from '@svelteuidev/core';
	import { hotkey, useOs } from '@svelteuidev/composables';
	import { page } from '$app/stores';
	const os = useOs();
	import { Sun, Moon } from 'radix-icons-svelte';
	const mod = os === 'macos' ? '⌘' : 'ctrl';
	export let isDark: boolean;
	export let toggle: () => void;
</script>

<Group override={{ height: '100%', px: 20 }} position="apart">
	<Box class="flex">
		<a href="/" style="text-decoration: none;" class="pr-5">
			<Group>
				<!-- <Logo size={35} /> -->
				<Text color="blue" size="xl" override={{ d: 'none', '@sm': { d: 'block' } }}>Someplice</Text
				>
			</Group>
		</a>
		<Box css={{ 'line-height': '0' }}>
			<Box class="flex-none">
				<Box root="ul" class="menu menu-horizontal px-2">
					<li><a href="/today" class:active={$page.url.pathname === '/today'}>Today</a></li>
					<li><a href="/goals" class:active={$page.url.pathname === '/goals'}>Goals</a></li>
				</Box>
			</Box>
		</Box>
	</Box>
	<Tooltip label={`${mod} + J`}>
		<ActionIcon variant="default" on:click={toggle} size={30} use={[[hotkey, [['mod+J', toggle]]]]}>
			{#if isDark}
				<Moon />
			{:else}
				<Sun />
			{/if}
		</ActionIcon>
	</Tooltip>
</Group>
