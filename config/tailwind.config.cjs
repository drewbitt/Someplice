const config = {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {}
	},
	plugins: [require('daisyui')],
	important: true,
	daisyui: {
		logs: false,
		prefix: 'daisy-',
		themes: false
	}
};

module.exports = config;
