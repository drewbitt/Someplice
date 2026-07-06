import nodeAdapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import denoAdapter from 'sveltekit-adapter-deno';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter:
			process.env.BUILD_ENV === 'deno'
				? denoAdapter({
						buildOptions: {
							banner: {
								js: `import { createRequire } from 'node:module';
									import { fileURLToPath } from 'node:url';
									import process from 'node:process';
									import Buffer from 'node:buffer';
									const require = createRequire(import.meta.url);
									const __filename = fileURLToPath(import.meta.url);`
							},
							bundle: true
						}
					})
				: nodeAdapter(),
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
