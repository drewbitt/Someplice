import { expect, test, type Page } from '@playwright/test';
import { openTestDb, resetTestDb } from './fixtures';
import { createNetworkSwitch } from './network';
import { dateKeyInZone, dayOfWeekFromDate } from '../src/lib/utils/index';

test.beforeEach(resetTestDb);

async function createGoal(page: Page, title = 'Read') {
	await page.goto('/goals');
	await page.getByRole('button', { name: 'New Goal', exact: true }).click();
	await page.getByRole('textbox', { name: 'Goal title', exact: true }).fill(title);
	await page.getByRole('button', { name: 'Create goal', exact: true }).click();
	await expect(page.locator('.goal-box-title').last()).toHaveText(title);
}

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

test('Today renders the same goal codes and configured date before and after hydration', async ({
	page,
	browser,
	baseURL
}) => {
	const timeZone = 'Etc/GMT+12';
	const day = dateKeyInZone(timeZone);
	const date = `${day}T12:00:00.000Z`;
	const db = openTestDb();
	try {
		db.prepare("INSERT INTO settings(key,value) VALUES('timezone',?)").run(timeZone);
		for (let id = 1; id <= 4; id++) {
			db.prepare('INSERT INTO goals(id,active,orderNumber,title,color) VALUES(?,?,?,?,?)').run(
				id,
				id === 4 ? 0 : 1,
				id === 4 ? 0 : id,
				`SSR goal ${id}`,
				'navy'
			);
			db.prepare('INSERT INTO goal_logs(goalId,type,date,orderNumber) VALUES(?,?,?,?)').run(
				id,
				id === 4 ? 'end' : 'start',
				date,
				id
			);
			db.prepare(
				'INSERT INTO intentions(goalId,orderNumber,status,text,subIntentionQualifier,date) VALUES(?,?,?,?,?,?)'
			).run(
				id,
				id,
				id === 3 ? 'not_today' : 'pending',
				`SSR action ${id}`,
				id === 2 ? 'a' : null,
				date
			);
		}
	} finally {
		db.close();
	}
	const serverContext = await browser.newContext({ javaScriptEnabled: false });
	try {
		const serverPage = await serverContext.newPage();
		await serverPage.goto(`${baseURL}/today`);
		await page.goto('/today');
		for (const view of [serverPage, page]) {
			for (const [index, code] of ['1)', '2a)', '-3)', 'x4)'].entries()) {
				await expect(
					view.getByRole('listitem', { name: `${code} SSR action ${index + 1}`, exact: true })
				).toBeVisible();
			}
			await expect(
				view.getByRole('button', {
					name: `Add more ${dayOfWeekFromDate(new Date(day))} intentions`
				})
			).toBeVisible();
			await expect(
				view.getByRole('heading', {
					name: new Intl.DateTimeFormat('en-US', {
						weekday: 'long',
						month: 'short',
						day: 'numeric',
						timeZone: 'UTC'
					}).format(new Date(day)),
					exact: true
				})
			).toBeVisible();
		}
	} finally {
		await serverContext.close();
	}
});

test('theme toggle persists dark mode across reload', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Toggle theme' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('a new goal stays unsaved until submission and cancellation leaves no history', async ({
	page
}) => {
	await page.goto('/goals');
	const newGoal = page.getByRole('button', { name: 'New Goal', exact: true });
	await expect(newGoal).toHaveCSS('cursor', 'pointer');
	await newGoal.click();
	const title = page.getByRole('textbox', { name: 'Goal title', exact: true });
	await expect(title).toBeFocused();
	await expect(page.getByRole('button', { name: 'Create goal', exact: true })).toBeDisabled();
	await title.fill('Maybe later');
	await page.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(newGoal).toBeFocused();
	await newGoal.click();
	await expect(title).toHaveValue('');
	await title.fill('Another idea');
	await title.press('Escape');
	await expect(newGoal).toBeFocused();
	const db = openTestDb();
	try {
		expect(db.prepare('SELECT COUNT(*) AS count FROM goals').get()).toEqual({ count: 0 });
		expect(db.prepare('SELECT COUNT(*) AS count FROM goal_logs').get()).toEqual({ count: 0 });
	} finally {
		db.close();
	}
	await newGoal.click();
	await title.fill('Build a reading habit');
	await title.press('Enter');
	await expect(page.locator('.goal-box-title')).toHaveText('Build a reading habit');
	await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.locator('.goal-box-title')).toHaveText('Build a reading habit');
});

test('intentions typed on Today persist across reload', async ({ page }) => {
	// Today hides the editor until a goal exists
	await createGoal(page);

	await page.goto('/today');
	const editor = page.locator('.goal__editor__textarea');
	await editor.fill('1) write tests');
	await expect(editor).toHaveValue('1) write tests');
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('todaysIntentions:v2')))
		.toBe(JSON.stringify('1) write tests'));

	await page.reload();
	await expect(page.locator('.goal__editor__textarea')).toHaveValue('1) write tests');
});

test('intention text activates with mouse and keyboard, and row reordering persists', async ({
	page
}) => {
	await createGoal(page);
	await page.goto('/today');
	await page
		.getByRole('textbox', { name: 'Daily intentions' })
		.fill('1) First step\n1) Second step');
	await page.getByRole('button', { name: /^Set \w+ intentions$/ }).click();
	const first = page.getByRole('button', { name: '1) First step', exact: true });
	const second = page.getByRole('button', { name: '1) Second step', exact: true });
	await first.click();
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('[aria-current="step"]')).toContainText('Second step');
	await first.press('Enter');
	await expect(first).toHaveAttribute('aria-pressed', 'false');
	await second.press('Space');
	await expect(second).toHaveAttribute('aria-pressed', 'true');
	await second.click();
	await expect(second).toHaveAttribute('aria-pressed', 'false');
	const firstRow = page.getByRole('listitem', { name: '1) First step', exact: true });
	await firstRow.focus();
	await firstRow.press('Enter');
	await expect(first).toBeDisabled();
	const reordered = page.waitForResponse((response) =>
		response.url().includes('/api/trpc/intentions.reorder')
	);
	await firstRow.press('ArrowUp');
	expect((await reordered).ok()).toBe(true);
	await expect(page.locator('.intention-row').first()).toContainText('First step');
	await page.keyboard.press('Escape');
	await expect(first).toBeEnabled();
	await page.reload();
	await expect(page.locator('.intention-row').first()).toContainText('First step');
	await expect(page.locator('[aria-current="step"]')).toContainText('First step');
});

test('completed intentions collect above the active queue and reopening persists as next', async ({
	page
}) => {
	await createGoal(page);
	await page.goto('/today');
	await page
		.getByRole('textbox', { name: 'Daily intentions' })
		.fill('1) First\n1) Second\n1) Third\n1) Fourth');
	await page.getByRole('button', { name: /^Set \w+ intentions$/ }).click();
	const rows = page.locator('.intention-row .goal-text');
	const action = (text: string) => page.getByRole('button', { name: `1) ${text}`, exact: true });
	await page.getByRole('checkbox', { name: '1) Third', exact: true }).check();
	await expect(rows).toHaveText(['1) Third', '1) First', '1) Second', '1) Fourth']);
	await expect(page.locator('[aria-current="step"]')).toContainText('First');
	await action('First').click();
	await expect(action('First')).toHaveAttribute('aria-pressed', 'true');
	await action('Fourth').click();
	await expect(rows).toHaveText(['1) Third', '1) First', '1) Fourth', '1) Second']);
	await expect(page.locator('[aria-current="step"]')).toContainText('Second');
	await page.reload();
	await expect(rows).toHaveText(['1) Third', '1) First', '1) Fourth', '1) Second']);
	await action('Fourth').press('Space');
	await expect(action('Fourth')).toHaveAttribute('aria-pressed', 'false');
	await expect(action('Fourth')).toBeFocused();
	await expect(page.locator('[aria-current="step"]')).toContainText('Fourth');
	await action('Third').press('Enter');
	await expect(rows).toHaveText(['1) First', '1) Third', '1) Fourth', '1) Second']);
	await page.reload();
	await expect(rows).toHaveText(['1) First', '1) Third', '1) Fourth', '1) Second']);
	await expect(page.locator('[aria-current="step"]')).toContainText('Third');
	for (const text of ['Third', 'Fourth', 'Second']) {
		await action(text).click();
		await expect(action(text)).toHaveAttribute('aria-pressed', 'true');
	}
	await expect(page.locator('[aria-current="step"]')).toHaveCount(0);
});

test('a cleared migrated draft stays cleared across navigation and reload', async ({ page }) => {
	await createGoal(page);
	await page.evaluate(() => {
		localStorage.removeItem('todaysIntentions:v2');
		localStorage.setItem('todaysIntentions', '1) legacy draft');
	});
	await page.goto('/today');
	const editor = page.getByRole('textbox', { name: 'Daily intentions' });
	await expect(editor).toHaveValue('1) legacy draft');
	await editor.fill('');
	await page.getByRole('link', { name: 'Goals', exact: true }).click();
	await page.getByRole('link', { name: 'Today', exact: true }).click();
	await expect(editor).toHaveValue('');
	await page.reload();
	await expect(editor).toHaveValue('');
	await editor.fill('null');
	await page.reload();
	await expect(editor).toHaveValue('null');
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
		await createGoal(page);

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
	await createGoal(page);
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
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
	context,
	baseURL
}) => {
	// Firefox's setOffline also blocks worker responses, so fail real network connections.
	const network = await createNetworkSwitch(baseURL!);
	try {
		await page.goto(`${network.url}/today`);
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
		const script = cached.find(
			(path) => path.startsWith('/_app/immutable/') && path.endsWith('.js')
		);
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
		network.goOffline();
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
		await expect(offlinePage.goto(`${network.url}/today`)).rejects.toThrow();
		await offlinePage.close();
	} finally {
		await network.close();
	}
});

test('worker updates wait for old clients and remove only obsolete app caches', async ({
	page,
	context,
	browserName
}) => {
	test.skip(
		browserName !== 'chromium',
		'Playwright exposes service worker targets only in Chromium.'
	);
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
