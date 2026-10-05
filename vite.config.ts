import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import denoAdapter from '@deno/svelte-adapter';
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
			adapter: process.env.BUILD_ENV === 'deno' ? denoAdapter() : nodeAdapter(),
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
			{
				extends: true,
				test: {
					name: 'browser',
					include: ['src/**/*.browser.test.ts'],
					setupFiles: ['vitest-browser-svelte'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		],
		reporters: [['default', { summary: false }]],
		env: {
			NODE_ENV: 'test'
		}
	}
});
