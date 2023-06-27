import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prepareStylesSSR } from '@svelteuidev/core';
import { createTRPCHandle } from 'trpc-sveltekit';
import { checkMissingOutcomes, createCronJobs } from './lib/db/cron';

export const trpcHandle: Handle = createTRPCHandle({ router, createContext });

export const sveltuiHandle = prepareStylesSSR;

export const handle = sequence(trpcHandle, sveltuiHandle);

// Check for missing outcomes from past days when the application is restarted
checkMissingOutcomes();

// Start cron jobs
createCronJobs();
