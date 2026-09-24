import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import denoAdapter from '@deno/svelte-adapter';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: process.env.BUILD_ENV === 'deno' ? denoAdapter() : nodeAdapter(),
		alias: {
			$src: './src',
			$db: './src/lib/db'
		},
		paths: {
			assets: ''
		}
	}
};

export default config;
