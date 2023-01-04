const config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {}
	},
	plugins: [require('daisyui')],
	important: true,
};

module.exports = config;
