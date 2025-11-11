import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import Icons from 'unplugin-icons/vite';

const basicReporterPath = fileURLToPath(new URL('./config/vitest-basic-reporter.ts', import.meta.url));

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		sveltekit(),
		SvelteKitPWA(),
		Icons({
			compiler: 'svelte'
		})
	],
	resolve: {
		alias: {
			basic: basicReporterPath
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
};

export default config;
