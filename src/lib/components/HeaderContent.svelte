<script lang="ts">
	import { Group, ActionIcon, Text, Burger, Tooltip } from '@svelteuidev/core';
	import { hotkey, useOs } from '@svelteuidev/composables';
	const os = useOs();
	import { Sun, Moon } from 'radix-icons-svelte';
	const mod = os === 'macos' ? '⌘' : 'ctrl';
	export let isDark: boolean;
	export let toggle: () => void;
</script>

<Group override={{ height: '100%', px: 20 }} position="apart">
	<a href="/" style="text-decoration: none;">
		<Group>
			<!-- <Logo size={35} /> -->
			<Text color="blue" size="xl" override={{ d: 'none', '@sm': { d: 'block' } }}>Someplice</Text>
		</Group>
	</a>
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
