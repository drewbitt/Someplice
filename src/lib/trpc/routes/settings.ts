import { logger } from '#lib/trpc/middleware/logger.js';
import { procedure, t } from '#lib/trpc/t.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from '#src/lib/db/db.js';
import {
	getConfiguredTimeZone,
	isValidTimeZone,
	setSetting,
	setSettingIfAbsent
} from '#src/lib/db/queries.js';

const TimeZoneSchema = z.object({
	timeZone: z.string()
});

export const settings = t.router({
	/**
	 * The effective timezone used for every day boundary (stored setting →
	 * SOMEPLICE_TIMEZONE → UTC).
	 */
	getTimeZone: procedure.use(logger).query(async () => {
		return getConfiguredTimeZone(getDb());
	}),
	/**
	 * Set the installation timezone. The browser's zone is written once via
	 * `ensureTimeZone`; this is the explicit override.
	 */
	setTimeZone: procedure
		.use(logger)
		.input(TimeZoneSchema)
		.mutation(async ({ input }) => {
			if (!isValidTimeZone(input.timeZone)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `"${input.timeZone}" is not a valid IANA timezone`
				});
			}
			await setSetting(getDb(), 'timezone', input.timeZone);
			return input.timeZone;
		}),
	/**
	 * Persist the browser's timezone when none is stored and no valid
	 * SOMEPLICE_TIMEZONE is configured — auto-detection on first load.
	 * Returns the zone that is now effective so the caller can update its
	 * rendering without a reload.
	 */
	ensureTimeZone: procedure
		.use(logger)
		.input(TimeZoneSchema)
		.mutation(async ({ input }) => {
			if (!isValidTimeZone(input.timeZone)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `"${input.timeZone}" is not a valid IANA timezone`
				});
			}
			const db = getDb();
			// Atomic write-once. A stored row already wins; a VALID operator-set
			// SOMEPLICE_TIMEZONE stays authoritative until an explicit
			// setTimeZone stores a row above it. An invalid env value is treated
			// as unset (getConfiguredTimeZone logs it and falls back anyway).
			const envZone = process.env.SOMEPLICE_TIMEZONE;
			if (!envZone || !isValidTimeZone(envZone)) {
				await setSettingIfAbsent(db, 'timezone', input.timeZone);
			}
			return getConfiguredTimeZone(db);
		})
});
