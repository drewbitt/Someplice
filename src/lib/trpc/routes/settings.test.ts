import { createDb, getDb, setDb } from '#src/lib/db/db.js';
import { runMigrations } from '#src/lib/db/migrate-to-latest.js';
import type { DB } from '#src/lib/types/data.js';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, router } from '../router';

describe('settings', () => {
	let db: Kysely<DB>;
	const createCaller = createCallerFactory(router);
	const caller = createCaller({});

	beforeEach(async () => {
		setDb(createDb(':memory:'));
		db = getDb();
		await runMigrations(db);
	});

	afterEach(async () => {
		await db.destroy();
	});

	it('defaults to UTC with no stored zone', async () => {
		expect(await caller.settings.getTimeZone()).toBe('UTC');
	});

	it('ensureTimeZone writes the browser zone once', async () => {
		expect(await caller.settings.ensureTimeZone({ timeZone: 'America/New_York' })).toBe(
			'America/New_York'
		);
		expect(await caller.settings.getTimeZone()).toBe('America/New_York');

		// a second browser with a different zone must not overwrite the stored one
		expect(await caller.settings.ensureTimeZone({ timeZone: 'Pacific/Kiritimati' })).toBe(
			'America/New_York'
		);
	});

	it('setTimeZone validates and overrides the stored zone', async () => {
		await expect(caller.settings.setTimeZone({ timeZone: 'not-a-zone' })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(await caller.settings.getTimeZone()).toBe('UTC');

		await caller.settings.setTimeZone({ timeZone: 'Asia/Tokyo' });
		expect(await caller.settings.getTimeZone()).toBe('Asia/Tokyo');
	});

	it('SOMEPLICE_TIMEZONE stays authoritative until an explicit setTimeZone', async () => {
		process.env.SOMEPLICE_TIMEZONE = 'Europe/Berlin';
		try {
			expect(await caller.settings.getTimeZone()).toBe('Europe/Berlin');

			// browser auto-detect must not clobber the operator's env zone
			expect(await caller.settings.ensureTimeZone({ timeZone: 'America/Chicago' })).toBe(
				'Europe/Berlin'
			);
			expect(await caller.settings.getTimeZone()).toBe('Europe/Berlin');

			// the explicit override still wins
			await caller.settings.setTimeZone({ timeZone: 'America/Chicago' });
			expect(await caller.settings.getTimeZone()).toBe('America/Chicago');
		} finally {
			delete process.env.SOMEPLICE_TIMEZONE;
		}
	});

	it('an invalid SOMEPLICE_TIMEZONE does not block browser auto-detect', async () => {
		process.env.SOMEPLICE_TIMEZONE = 'Europe/Unknown';
		try {
			expect(await caller.settings.ensureTimeZone({ timeZone: 'America/Chicago' })).toBe(
				'America/Chicago'
			);
			expect(await caller.settings.getTimeZone()).toBe('America/Chicago');
		} finally {
			delete process.env.SOMEPLICE_TIMEZONE;
		}
	});
});
