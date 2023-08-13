import { expect, test } from '@playwright/test';

test('index page has expected h1', async ({ page }) => {
	await page.goto('/');
	expect(await page.textContent('h1')).toBe('Someplice');
});

/* TODO: Update as this expects an empty DB */
test('Today page shows text when no goals are set', async ({ page }) => {
	await page.goto('/today');
	expect(await page.textContent('#no-goals-notification > div > div')).toBe(
		'You have no goals. Please add some goals first.'
	);
});

test('GoalBox contains New goal button', async ({ page }) => {
	await page.goto('/goals');
	expect(await page.textContent('#new-goal-button > div')).toBe('New Goal');
});

/* TODO: Update as this expects an empty DB */
test('Pressing New Goal button adds a new goal', async ({ page }) => {
	await page.goto('/goals');
	await page.click('#new-goal-button');
	await page.waitForSelector('#goals-list-container > :nth-child(1)');
	const goalsListContainer = await page.waitForSelector('#goals-list-container');
	const newGoalInput = await goalsListContainer.$('#input-id');

	// Expect container to have 1 child (:scope = current element eval is being run on)
	expect(await goalsListContainer.$$eval(':scope > *', (el) => el.length)).toBe(1);
	// Expect input to have value 'Goal 1'
	expect(await newGoalInput?.evaluate((el) => (el as HTMLInputElement).value)).toBe('Goal 1');
});