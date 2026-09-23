import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
	webServer: {
		command: 'pnpm run db:migrate && pnpm run build && pnpm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
