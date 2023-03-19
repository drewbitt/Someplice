<script>
	import { Title } from '@svelteuidev/core';

	export let title = 'Someplice';
	export let subtitle = 'Achieve your goals with daily intentions';
</script>

<div class="flex justify-center">
	<div class="max-w-2xl">
		<header class="mb-8">
			<Title order={1} color="blue">{title}</Title>
			<p class="italic">{subtitle}</p>
		</header>

		<section>
			<Title order={2}>Features</Title>
			<ul>
				<li>🎯 Set and manage multiple goals</li>
				<li>📅 Set daily intentions for each goal</li>
				<li>✅ Mark intentions as complete</li>
				<li>☀️/🌙 Toggle between light and dark mode</li>
			</ul>
		</section>
	</div>
</div>
