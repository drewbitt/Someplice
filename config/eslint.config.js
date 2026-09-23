import globals from 'globals';
import js from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import eslintConfigPrettier from 'eslint-config-prettier';
import svelteConfig from '../svelte.config.js';

export default [
	js.configs.recommended,
	...tsEslint.configs.recommended,
	...tsEslint.configs.stylistic,
	...eslintPluginSvelte.configs['flat/recommended'],
	...eslintPluginSvelte.configs['flat/prettier'],
	eslintConfigPrettier,
	{
		files: ['**/*.{js,mjs,cjs,ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.browser,
				...globals.es2017
			}
		},
		rules: {
			'no-undef': 'off',
			'no-useless-assignment': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }
			]
		}
	},
	{
		// eslint-plugin-svelte routes *.svelte and *.svelte.{js,ts} through svelte-eslint-parser;
		// ts.parser is the inner parser for their script content.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.browser,
				$state: 'readonly',
				$derived: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly',
				$effect: 'readonly'
			},
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: tsEslint.parser,
				svelteConfig
			}
		},
		rules: {
			'no-undef': 'off',
			'no-useless-assignment': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }
			],
			'@typescript-eslint/no-unused-expressions': 'off', // to allow Svelte reactive statements for now
			'svelte/no-immutable-reactive-statements': 'off', // Too many false positives with Svelte 5
			'svelte/infinite-reactive-loop': 'warn', // Change to warning instead of error
			'svelte/no-navigation-without-resolve': 'off', // We're using standard SvelteKit navigation
			'svelte/valid-prop-names-in-kit-pages': 'off' // We use custom props in page components
		}
	},
	{
		ignores: [
			'**/.*', // dotfiles aren't ignored by default in FlatConfig
			'.*', // dotfiles aren't ignored by default in FlatConfig
			'**/.DS_Store',
			'**/node_modules',
			'**/build',
			'/.svelte-kit',
			'**/package',
			'**/.env',
			'**/.env.*',
			'!**/.env.example',
			'**/pnpm-lock.yaml',
			'**/package-lock.json',
			'**/yarn.lock',
			'**/*.cjs',
			'.github',
			'.vscode',
			'src-tauri',
			'**/eslint.config.js',
			'**/svelte.config.js',
			'**/test-results',
			'**/playwright-report',
			'**/.pnpm-store',
			'**/vite.config.ts.timestamp-*'
		]
	},
	{
		languageOptions: {
			parserOptions: {
				warnOnUnsupportedTypeScriptVersion: false
			}
		}
	}
];
