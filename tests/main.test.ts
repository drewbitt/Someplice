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
import { DatabaseSync } from 'node:sqlite';

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
	// The New Goal box sits outside the dnd list, so the container holds just
	// the created goal box.
	await expect(goalsListContainer.locator(':scope > *')).toHaveCount(1);
	// Adding a goal enters edit mode, so the title is rendered as an input
	await expect(goalsListContainer.locator('.goal-box-title-editable input')).toHaveValue('Goal 1');
});

test('theme toggle persists dark mode across reload', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Toggle theme' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('intentions typed on Today persist across reload', async ({ page }) => {
	// Today hides the editor until a goal exists
	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal' }).click();
	await expect(page.locator('.goal-box-title-editable input').last()).toHaveValue(/Goal/);

	await page.goto('/today');
	const editor = page.locator('.goal__editor__textarea');
	await editor.fill('1) write tests');
	await expect(editor).toHaveValue('1) write tests');

	await page.reload();
	await expect(page.locator('.goal__editor__textarea')).toHaveValue('1) write tests');
});

test('Today loads missed intentions in the stored timezone on a fresh browser visit', async ({
	browser
}) => {
	const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/db.sqlite');
	try {
		db.prepare(
			"INSERT INTO settings(key, value) VALUES('timezone', 'UTC') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
		).run();
	} finally {
		db.close();
	}

	const now = new Date();
	const browserZone = now.getUTCHours() >= 10 ? 'Pacific/Kiritimati' : 'Etc/GMT+12';
	const yesterday = new Date(now);
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);

	const context = await browser.newContext({ timezoneId: browserZone });
	try {
		const page = await context.newPage();
		await page.goto('/goals');
		await page.getByRole('button', { name: 'New Goal' }).click();
		await expect(page.locator('.goal-box-title-editable input').last()).toHaveValue(/Goal/);

		const recentIntentions = page.waitForResponse((response) =>
			response.url().includes('/api/trpc/intentions.list?')
		);
		await page.goto('/today');
		const response = await recentIntentions;
		const input = new URL(response.url()).searchParams.get('input');
		expect(input).toContain(yesterday.toISOString().slice(0, 10));
		expect(input).not.toContain(now.toISOString().slice(0, 10));

		await page.locator('.goal__editor__textarea').fill('1) timezone refresh persists');
		await page.getByRole('button', { name: /^Set \w+ intentions$/ }).click();
		const intention = page.getByRole('listitem', {
			name: '1) timezone refresh persists',
			exact: true
		});
		await expect(intention).toBeVisible();

		const reloadedIntentions = page.waitForResponse((response) =>
			response.url().includes('/api/trpc/intentions.list?')
		);
		await page.reload();
		const reloadedResponse = await reloadedIntentions;
		expect(new URL(reloadedResponse.url()).searchParams.get('input')).not.toContain(
			now.toISOString().slice(0, 10)
		);
		await expect(intention).toBeVisible();
	} finally {
		await context.close();
	}
});

test('failed goal saves preserve the draft for retry or cancellation', async ({ page }) => {
	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal', exact: true }).click();
	const title = page.locator('.goal-box-title-editable input').last();
	const description = page.locator('.goal-box-description-editable textarea').last();
	const originalTitle = await title.inputValue();
	await title.fill('Draft preserved after failure');
	await description.fill('Unsaved description');

	await page.route('**/api/trpc/goals.updateGoals*', (route) => route.abort('failed'));
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.locator('.alert-error')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
	await expect(title).toHaveValue('Draft preserved after failure');
	await expect(description).toHaveValue('Unsaved description');

	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(page.locator('.goal-box-title').last()).toHaveText(originalTitle);
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await title.fill('Retry persisted');
	await description.fill('Retry description');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(title).toHaveValue('Retry persisted');
	await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

	await page.unroute('**/api/trpc/goals.updateGoals*');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
	await expect(page.locator('.goal-box-title').last()).toHaveText('Retry persisted');
	await page.reload();
	await expect(page.locator('.goal-box-title').last()).toHaveText('Retry persisted');
	await expect(page.locator('.goal-box-description').last()).toHaveText('Retry description');
});

test('Journey refreshes server and paginated days without duplicating milestones', async ({
	page
}) => {
	const day = new Date().toISOString().slice(0, 10);
	const dates = Array.from({ length: 17 }, (_, index) => {
		const date = new Date(`${day}T12:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() - index);
		return date.toISOString().slice(0, 10);
	});
	const olderDay = dates[dates.length - 1];
	const db = new DatabaseSync(process.env.DATABASE_PATH ?? './data/db.sqlite');
	try {
		const goal = db
			.prepare('SELECT id FROM goals WHERE active = 1 ORDER BY orderNumber LIMIT 1')
			.get();
		if (!goal || typeof goal.id !== 'number') throw new Error('Expected an active goal');
		db.prepare("UPDATE goal_logs SET date = ? WHERE goalId = ? AND type = 'start'").run(
			`${olderDay}T00:00:00.000Z`,
			goal.id
		);
		const insertOutcome = db.prepare('INSERT OR IGNORE INTO outcomes(date, reviewed) VALUES(?, 1)');
		for (const date of dates) insertOutcome.run(date);
		for (const [date, text] of [
			[day, 'Server milestone'],
			[olderDay, 'Paginated milestone']
		]) {
			db.prepare(
				'INSERT INTO priorities(goalId, text, createdAt, completedAt) VALUES(?, ?, ?, ?)'
			).run(goal.id, text, `${date}T00:00:00.000Z`, `${date}T12:00:00.000Z`);
		}
	} finally {
		db.close();
	}

	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/journey');
	await expect(
		page.getByText('★ 1 completed top priority: Server milestone', { exact: true })
	).toHaveCount(1);
	await page.locator('.pagination-trigger').scrollIntoViewIfNeeded();
	await expect(page.locator(`#journey-outcomes-box-${dates[15]}`)).toBeVisible();
	await page.locator('.pagination-trigger').scrollIntoViewIfNeeded();
	await expect(page.locator(`#journey-outcomes-box-${olderDay}`)).toBeVisible();

	for (const [date, text] of [
		[day, 'Server milestone'],
		[olderDay, 'Paginated milestone']
	]) {
		const box = page.locator(`#journey-outcomes-box-${date}`);
		const review = box.getByRole('listitem', { name: 'Review Goal Box' }).first();
		for (const verdict of ['yes', 'no']) {
			if (verdict === 'no') {
				await review
					.getByRole('button', { name: 'Add another outcome not already listed' })
					.click();
			}
			await review.getByRole('button', { name: verdict, exact: true }).click();
			const reconciled = page.waitForResponse((response) =>
				response.url().includes('/api/trpc/goals.listGoalsOnDate')
			);
			await box.getByRole('button', { name: 'Save', exact: true }).click();
			await reconciled;
			await expect(box.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
			await expect(
				page.getByText(`★ 1 completed top priority: ${text}`, { exact: true })
			).toHaveCount(1);
			await expect(page.locator(`#journey-outcomes-box-${olderDay}`)).toBeVisible();
			expect(errors).toEqual([]);
		}
	}
	await page.reload();
	await expect(
		page.getByText('★ 1 completed top priority: Server milestone', { exact: true })
	).toHaveCount(1);
	expect(errors).toEqual([]);
});
