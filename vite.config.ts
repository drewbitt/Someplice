import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: nodeAdapter(),
			output: { linkHeaderPreload: true }
		}),

		Icons({
			compiler: 'svelte'
		})
	],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.browser.test.ts']
				}
			},
			...(['chromium', 'firefox', 'webkit'] as const).map((browser) => ({
				extends: true,
				test: {
					name: `browser-${browser}`,
					include: ['src/**/*.browser.test.ts'],
					setupFiles: ['vitest-browser-svelte'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						trace: { mode: 'retain-on-failure', tracesDir: `test-results/vitest/${browser}` },
						instances: [{ browser }]
					}
				}
			}))
		],
		reporters: [['default', { summary: false }]],
		env: {
			NODE_ENV: 'test'
		}
	}
});
