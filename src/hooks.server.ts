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

// Check for missing outcomes from past days when the application is restarted
checkMissingOutcomes();

// Start cron jobs
createCronJobs();
