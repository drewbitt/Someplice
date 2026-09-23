/*
 * 09/13/2023: Playwright is blocked by https://github.com/microsoft/playwright/issues/19411
 * Any $src, $lib imports won't work.
 * So, we can't import methods to create an in-memory DB for testing as they rely on the imports.
 */

/*
 * Playwright tests for the main app. Tests are expected to run on an empty database.
 * Vitest tests are in the same directory as the code they are testing.
 */

import { expect, test } from '@playwright/test';

test('index page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Someplice', level: 1 })).toBeVisible();
});

test('Today page shows text when no goals are set', async ({ page }) => {
	await page.goto('/today');
	await expect(
		page.getByRole('alert').getByText('You have no goals. Please add some goals first.')
	).toBeVisible();
});

test('GoalBox contains New goal button', async ({ page }) => {
	await page.goto('/goals');
	await expect(page.getByRole('button', { name: 'New Goal' })).toBeVisible();
});

test('Pressing New Goal button adds a new goal', async ({ page }) => {
	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal' }).click();
	const goalsListContainer = page.locator('#goals-list-container');
	// The created goal box plus the "New Goal" box itself are the container's two children
	await expect(goalsListContainer.locator(':scope > *')).toHaveCount(2);
	// Adding a goal enters edit mode, so the title is rendered as an input
	await expect(goalsListContainer.locator('.goal-box-title-editable input')).toHaveValue('Goal 1');
});
