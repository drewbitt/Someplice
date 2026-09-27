import { building } from '$app/environment';
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { checkMissingOutcomes, createCronJobs } from './lib/db/cron';
import { getDb } from './lib/db/db';
import { runMigrations } from './lib/db/migrate-to-latest';
import { trpcLogger } from './lib/utils/logger';

const trpcEndpoint = '/api/trpc';

// Database and cron work must not run at module import: this file is imported during
// `vite build`, where the database does not exist yet. Initialize on the first request.
// The promise is memoized so concurrent first requests share a single initialization.
let initPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
	if (building) {
		return Promise.resolve();
	}
	if (!initPromise) {
		initPromise = (async () => {
			// Run pending migrations first so the rest of startup sees a current schema.
			await runMigrations(getDb());
			await checkMissingOutcomes();
			createCronJobs();
		})().catch((error) => {
			// allow the next request to retry rather than pinning a failed init
			initPromise = null;
			throw error;
		});
	}
	return initPromise;
}

export const handle: Handle = async ({ event, resolve }) => {
	await ensureInitialized();

	if (event.url.pathname.startsWith(trpcEndpoint)) {
		return fetchRequestHandler({
			endpoint: trpcEndpoint,
			req: event.request,
			router,
			createContext: () => createContext(event),
			onError({ type, path, error }) {
				const payload = {
					'Encountered error while trying to process request in trpcHandle': { type, path, error }
				};
				if (error.code !== 'INTERNAL_SERVER_ERROR') {
					trpcLogger.warn(payload);
				} else {
					trpcLogger.error(payload);
				}
			}
		});
	}

	return resolve(event);
};
