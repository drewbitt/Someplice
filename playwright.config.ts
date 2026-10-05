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
	projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
	webServer: {
		command: 'pnpm run db:migrate && pnpm run build && pnpm run preview -- --strictPort',
		env: { DATABASE_PATH: process.env.DATABASE_PATH, SOMEPLICE_TIMEZONE: 'UTC' },
		port: 4173,
		reuseExistingServer: false
	}
});
