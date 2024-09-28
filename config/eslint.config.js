import globals from 'globals';
import js from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import tsParser from '@typescript-eslint/parser';

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
			parser: svelteParser,
			parserOptions: {
				parser: tsParser,
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
			'@typescript-eslint/no-unused-expressions': 'off' // to allow Svelte reactive statements for now
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
