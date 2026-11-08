import { expect, test } from '@playwright/test';
import { openTestDb, resetTestDb } from './fixtures';

test.beforeEach(() => {
	resetTestDb();
	const db = openTestDb();
	try {
		db.prepare(
			"INSERT INTO goals(id,active,orderNumber,title,color) VALUES(1,1,1,'Read','navy')"
		).run();
		db.prepare(
			"INSERT INTO intentions(id,goalId,orderNumber,status,text,date) VALUES(1,1,1,'pending','Read a chapter',?)"
		).run(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`);
	} finally {
		db.close();
	}
});

test('Pomodoro survives navigation/reload and reconciles expiration across tabs once', async ({
	page,
	context
}) => {
	await page.goto('/today');
	await expect(page.getByRole('combobox', { name: 'Work on' })).toHaveValue('1');
	await page.getByText('Timer settings', { exact: true }).click();
	await page.getByRole('spinbutton', { name: 'Pomodoro minutes' }).fill('1');
	await page.getByRole('button', { name: 'Start Pomodoro · 1m' }).click();
	await expect(page.getByRole('timer')).toBeVisible();
	await page.getByRole('link', { name: 'Goals', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Pomodoro', exact: true })).toHaveText(
		/Read a chapter/
	);
	await page.reload();
	await expect(page.getByRole('timer')).toBeVisible();
	const other = await context.newPage();
	await other.goto('/today');
	await expect(other.getByRole('timer')).toBeVisible();
	await other.getByRole('button', { name: 'Cancel Pomodoro', exact: true }).click();
	await other.getByRole('dialog').getByRole('button', { name: 'Keep working' }).click();
	await expect(other.getByRole('timer')).toBeVisible();
	const db = openTestDb();
	try {
		db.prepare("UPDATE focus_sessions SET startedAt=?, lastStartedAt=? WHERE status='running'").run(
			Date.now() - 61_000,
			Date.now() - 61_000
		);
	} finally {
		db.close();
	}
	await Promise.all([page.reload(), other.reload()]);
	await expect(other.getByText('1 Pomodoro · 1 min recorded today')).toBeVisible();
	await expect(other.getByRole('button', { name: 'Take break · 5m' })).toBeVisible();
	const check = openTestDb();
	try {
		expect(check.prepare('SELECT status, elapsedSeconds FROM focus_sessions').all()).toEqual([
			{ status: 'completed', elapsedSeconds: 60 }
		]);
		expect(check.prepare('SELECT status FROM intentions WHERE id=1').get()).toEqual({
			status: 'pending'
		});
	} finally {
		check.close();
	}
	await other.close();
});

test('hourglass saves partial time, excludes its pause and restores persisted preferences', async ({
	page
}) => {
	await page.goto('/today');
	await page.getByRole('combobox', { name: 'Mode' }).selectOption('hourglass');
	await page.getByText('Timer settings', { exact: true }).click();
	await page.getByRole('spinbutton', { name: 'Hourglass minutes' }).fill('12');
	await page.getByRole('button', { name: 'Start hourglass · 12m' }).click();
	await expect(page.getByRole('timer')).toBeVisible();
	const db = openTestDb();
	try {
		db.prepare("UPDATE focus_sessions SET lastStartedAt=? WHERE status='running'").run(
			Date.now() - 120_000
		);
	} finally {
		db.close();
	}
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	const paused = await page.getByRole('timer').textContent();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
	await expect(page.getByRole('timer')).toHaveText(paused!);
	await page.getByRole('button', { name: 'Save & stop' }).click();
	await expect(page.getByText('0 Pomodoros · 2 min recorded today')).toBeVisible();
	await page.reload();
	await page.getByRole('combobox', { name: 'Mode' }).selectOption('hourglass');
	await expect(page.getByRole('button', { name: 'Start hourglass · 12m' })).toBeVisible();
	await page.getByText("Today's sessions", { exact: true }).click();
	await expect(page.getByRole('region', { name: 'Focus timer' }).getByRole('list')).toHaveText(
		/Read a chapter.*Hourglass.*02:0/
	);
});
