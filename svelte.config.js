import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/kit/vite';

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
		adapter: adapter(),
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
