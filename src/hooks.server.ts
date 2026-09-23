import { building } from '$app/environment';
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { checkMissingOutcomes, createCronJobs } from './lib/db/cron';
import { trpcLogger } from './lib/utils/logger';

const trpcEndpoint = '/api/trpc';

// Database and cron work must not run at module import: this file is imported during
// `vite build`, where the database does not exist yet. Initialize on the first request.
let initialized = false;
async function ensureInitialized() {
	if (building || initialized) {
		return;
	}
	// Check for missing outcomes from past days when the application is restarted.
	// The order of these calls is critical: checkMissingOutcomes uses the presence of the
	// cron job (created by createCronJobs) as an indicator of whether it should run, so it
	// MUST always run before createCronJobs.
	await checkMissingOutcomes();
	createCronJobs();
	initialized = true;
}

export const trpcHandle: Handle = async ({ event, resolve }) => {
	await ensureInitialized();

	if (event.url.pathname.startsWith(trpcEndpoint)) {
		return fetchRequestHandler({
			endpoint: trpcEndpoint,
			req: event.request,
			router,
			createContext: () => createContext(event),
			onError({ type, path, error }) {
				trpcLogger.error({
					'Encountered error while trying to process request in trpcHandle': { type, path, error }
				});
			}
		});
	}

	return resolve(event);
};

export const handle = trpcHandle;
