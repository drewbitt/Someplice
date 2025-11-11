import globals from 'globals';
import js from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import eslintConfigPrettier from 'eslint-config-prettier';

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
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			ecmaVersion: 2020,
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
				parser: tsEslint.parser,
				extraFileExtensions: ['.svelte'],
				svelteFeatures: {
					experimentalGenerics: true
				}
			}
		},
		rules: {
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
