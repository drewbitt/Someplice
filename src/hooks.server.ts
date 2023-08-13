import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prepareStylesSSR } from '@svelteuidev/core';
import { createTRPCHandle } from 'trpc-sveltekit';
import { checkMissingOutcomes, createCronJobs } from './lib/db/cron';
import { trpcLogger } from './lib/utils/logger';

export const trpcHandle: Handle = createTRPCHandle({
	router,
	createContext,
	onError({ type, path, error }) {
		trpcLogger.error({
			'Encountered error while trying to process request in trpcHandle': { type, path, error }
		});
	}
});

export const sveltuiHandle = prepareStylesSSR;

export const handle = sequence(trpcHandle, sveltuiHandle);

function initializeServerHooks() {
	// Check for missing outcomes from past days when the application is restarted.
	// The order of these function calls is critical. The checkMissingOutcomes function uses the presence
	// or absence of the cron job (set up in createCronJobs) as an indicator of whether it should run or not.
	// Therefore, checkMissingOutcomes MUST always be called before createCronJobs to ensure correct behavior.
	checkMissingOutcomes();

	// Start cron jobs
	createCronJobs();
}

initializeServerHooks();
