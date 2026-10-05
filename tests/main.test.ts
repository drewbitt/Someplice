import { expect, test } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';

function openTestDb() {
	const db = new DatabaseSync(process.env.DATABASE_PATH!);
	db.exec('PRAGMA foreign_keys = ON');
	db.function('regexp', { deterministic: true }, (regex, text) =>
		typeof regex === 'string' && typeof text === 'string'
			? new RegExp(regex).test(text)
				? 1
				: 0
			: null
	);
	return db;
}

test.beforeEach(() => {
	const db = openTestDb();
	try {
		db.exec('DELETE FROM goals; DELETE FROM outcomes; DELETE FROM settings;');
	} finally {
		db.close();
	}
});

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
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('todaysIntentions')))
		.toBe('1) write tests');

	await page.reload();
	await expect(page.locator('.goal__editor__textarea')).toHaveValue('1) write tests');
});

test('Today loads missed intentions in the stored timezone on a fresh browser visit', async ({
	browser
}) => {
	const db = openTestDb();
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
	const failedRetry = page.waitForEvent('requestfailed', {
		predicate: (request) => request.url().includes('/api/trpc/goals.updateGoals')
	});
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await failedRetry;
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
	const db = openTestDb();
	try {
		const inserted = db
			.prepare(
				"INSERT INTO goals(active, title, description, color, orderNumber) VALUES(1, 'Journey goal', '', 'red', 1)"
			)
			.run();
		const goal = { id: Number(inserted.lastInsertRowid) };
		db.prepare(
			"INSERT INTO goal_logs(goalId, type, date, orderNumber) VALUES(?, 'start', ?, 1)"
		).run(goal.id, `${olderDay}T00:00:00.000Z`);
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

test('failed additional intention saves retry the corrected draft without rewriting existing rows', async ({
	page
}) => {
	const db = openTestDb();
	const timestamp = new Date().toISOString();
	try {
		const inserted = db
			.prepare(
				"INSERT INTO goals(active, title, description, color, orderNumber) VALUES(1, 'Read', '', 'navy', 1)"
			)
			.run();
		const goalId = Number(inserted.lastInsertRowid);
		db.prepare(
			"INSERT INTO goal_logs(goalId, type, date, orderNumber) VALUES(?, 'start', ?, 1)"
		).run(goalId, timestamp);
		db.prepare(
			"INSERT INTO intentions(goalId, text, date, orderNumber, status) VALUES(?, 'Original', ?, 1, 'pending')"
		).run(goalId, timestamp);
	} finally {
		db.close();
	}
	await page.goto('/today');
	await page.getByRole('button', { name: /^Add more \w+ intentions$/ }).click();
	const editor = page.getByRole('textbox', { name: 'Daily intentions' });
	await editor.fill('1) Stale draft');
	await page.route('**/api/trpc/intentions.updateIntentions*', (route) =>
		route.fulfill({ status: 500, body: 'offline' })
	);
	await page.getByRole('button', { name: /^Set \w+ intentions$/ }).click();
	await expect(page.getByText('Error saving intentions', { exact: true })).toBeVisible();
	await editor.fill('1) Corrected draft');
	await page.unroute('**/api/trpc/intentions.updateIntentions*');
	await page.getByRole('button', { name: /^Set \w+ intentions$/ }).click();
	await expect(editor).not.toBeVisible();
	const saved = openTestDb();
	try {
		expect(
			saved.prepare('SELECT text, status, orderNumber FROM intentions ORDER BY orderNumber').all()
		).toEqual([
			{ text: 'Original', status: 'pending', orderNumber: 1 },
			{ text: 'Corrected draft', status: 'pending', orderNumber: 2 }
		]);
	} finally {
		saved.close();
	}
});

test('controlled worker serves assets offline but never dynamic pages, data or APIs', async ({
	page,
	context
}) => {
	await page.goto('/today');
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
	await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	const cached = await page.evaluate(async () => {
		const names = (await caches.keys()).filter((name) => name.startsWith('someplice-'));
		const entries = await Promise.all(
			names.map(async (name) =>
				(await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)
			)
		);
		return entries.flat();
	});
	expect(cached.length).toBeGreaterThan(0);
	expect(cached.some((path) => path.startsWith('/_app/immutable/'))).toBe(true);
	expect(cached).not.toContain('/today');
	expect(cached.some((path) => path.startsWith('/api/trpc'))).toBe(false);
	const script = cached.find((path) => path.startsWith('/_app/immutable/') && path.endsWith('.js'));
	expect(script).toBeDefined();
	const dynamicPaths = ['/today', '/today/__data.json', '/api/trpc/settings.getTimeZone'];
	const statuses = await page.evaluate(
		async (paths) =>
			Promise.all(paths.map(async (path) => (await fetch(path, { cache: 'no-store' })).status)),
		dynamicPaths
	);
	expect(statuses).toEqual([200, 200, 200]);
	const readAsset = () =>
		page.evaluate(async (path) => (await fetch(path, { cache: 'no-store' })).text(), script!);
	const onlineAsset = await readAsset();
	expect(onlineAsset.length).toBeGreaterThan(0);
	await context.setOffline(true);
	try {
		expect(await readAsset()).toBe(onlineAsset);
		const reachable = await page.evaluate(
			async (paths) =>
				Promise.all(
					paths.map(async (path) => {
						try {
							await fetch(path, { cache: 'no-store' });
							return true;
						} catch {
							return false;
						}
					})
				),
			dynamicPaths
		);
		expect(reachable).toEqual([false, false, false]);
		const offlinePage = await context.newPage();
		await expect(offlinePage.goto('/today')).rejects.toThrow(
			/ERR_INTERNET_DISCONNECTED|ERR_FAILED/
		);
		await offlinePage.close();
	} finally {
		await context.setOffline(false);
	}
});

test('worker updates wait for old clients and remove only obsolete app caches', async ({
	page,
	context
}) => {
	await page.goto('/today');
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
	await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	const currentScript = await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL);
	const currentCaches = await page.evaluate(async () =>
		(await caches.keys()).filter((name) => name.startsWith('someplice-'))
	);
	const nextScript = `${currentScript}?e2e-update`;
	const workerCreated = context.waitForEvent('serviceworker', {
		predicate: (worker) => worker.url() === nextScript
	});
	await page.evaluate(async (url) => {
		await (
			await caches.open('someplice-obsolete-version')
		).put('/obsolete.js', new Response('old'));
		await (await caches.open('unrelated-app')).put('/unrelated.js', new Response('keep'));
		// A distinct script URL exercises an update with the production worker, without a second build.
		await navigator.serviceWorker.register(url);
	}, nextScript);
	const nextWorker = await workerCreated;
	await expect
		.poll(() =>
			page.evaluate(
				async () => (await navigator.serviceWorker.getRegistration())?.waiting?.scriptURL
			)
		)
		.toBe(nextScript);
	expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(
		currentScript
	);
	expect(await page.evaluate(() => caches.keys())).toContain('someplice-obsolete-version');
	await page.close();
	await expect
		.poll(() => nextWorker.evaluate(() => caches.keys()))
		.not.toContain('someplice-obsolete-version');
	const remaining = await nextWorker.evaluate(() => caches.keys());
	expect(remaining).toContain('unrelated-app');
	expect(remaining.filter((name) => name.startsWith('someplice-'))).toEqual(currentCaches);
	const nextPage = await context.newPage();
	await nextPage.goto('/manifest.webmanifest');
	await expect
		.poll(() => nextPage.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
		.toBe(nextScript);
});
