import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests',
	// Tests share a single sqlite db behind the preview server, so they must
	// not run concurrently — state created by one test is visible to another.
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
	webServer: {
		// wipe the dev db so the suite always starts from an empty schema
		command: 'rm -f data/db.sqlite && pnpm run db:migrate && pnpm run build && pnpm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	}
});
