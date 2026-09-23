import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			manifest: {
				name: 'Someplice',
				short_name: 'Someplice',
				description: 'Daily intentions and outcomes tracker',
				theme_color: '#ffffff',
				background_color: '#ffffff',
				display: 'standalone',
				icons: [
					{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
				]
			}
		}),
		Icons({
			compiler: 'svelte'
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		reporters: [['default', { summary: false }]],
		env: {
			NODE_ENV: 'test'
		}
	}
};

export default config;
