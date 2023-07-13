import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/kit/vite';
import preprocess from 'svelte-preprocess';
import denoAdapter from 'sveltekit-adapter-deno';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: [
		vitePreprocess(),
		preprocess({
			postcss: true
		})
	],

	kit: {
		adapter: process.env.BUILD_ENV === 'deno' ? denoAdapter() : nodeAdapter(),
		alias: {
			$src: './src',
			$db: './src/lib/db',
			tailwindConfig: 'tailwind.config.cjs'
		},
		paths: {
			// assets: either `paths.assets`, if specified, or a relative path to `paths.base`
			// has to be an absolute path
			// path.resolve("./src/lib/assets") does not work
			assets: ''
		}
	}
};

export default config;
