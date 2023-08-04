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
		adapter:
			// Building for deno will never work as long as better-sqlite3 is broken in it
			// But, let's start trying anyway
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
