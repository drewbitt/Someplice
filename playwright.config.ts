import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const databaseDirectory =
	process.env.SOMEPLICE_E2E_DIRECTORY ?? mkdtempSync(join(tmpdir(), 'someplice-e2e-'));
process.env.SOMEPLICE_E2E_DIRECTORY = databaseDirectory;
process.env.DATABASE_PATH = join(databaseDirectory, 'db.sqlite');
process.env.SOMEPLICE_TIMEZONE = 'UTC';

export default defineConfig({
	testDir: 'tests',
	outputDir: 'test-results/playwright',
	metadata: { databaseDirectory },
	globalTeardown: './tests/global-teardown.ts',
	// One disposable database per run; each scenario resets its fixtures.
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'chromium', use: devices['Desktop Chrome'] },
		{ name: 'firefox', use: devices['Desktop Firefox'], testIgnore: '**/api.test.ts' },
		{ name: 'webkit', use: devices['Desktop Safari'], testIgnore: '**/api.test.ts' }
	],
	webServer: {
		command: 'pnpm run db:migrate && pnpm run build && node build/index.js',
		env: {
			DATABASE_PATH: process.env.DATABASE_PATH,
			SOMEPLICE_TIMEZONE: 'UTC',
			TZ: 'Pacific/Kiritimati',
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '4173'
		},
		port: 4173,
		reuseExistingServer: false
	}
});
