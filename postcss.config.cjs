const autoprefixer = require('autoprefixer');

const config = {
	plugins: [
		// Tailwind CSS is now handled by the @tailwindcss/vite plugin in vite.config.ts
		// Only autoprefixer remains here for other PostCSS processing
		autoprefixer
	]
};

module.exports = config;
