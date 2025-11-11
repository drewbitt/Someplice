import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import Icons from 'unplugin-icons/vite';
import tailwindcss from '@tailwindcss/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA(),
		Icons({
			compiler: 'svelte'
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		reporters: [['default', { summary: false }]]
	}
};

export default config;
