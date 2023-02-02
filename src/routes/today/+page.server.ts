import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: router.createCaller(await createContext(event)).goals.list(1),
	intentions: router.createCaller(await createContext(event)).intentions.list({
		// Get today's date with times set to 00:00:00.000 and 23:59:59.999
		startDate: new Date().toISOString().split('T')[0],
		endDate: new Date().toISOString().split('T')[0] + 'T23:59:59.999Z'
	})
});
