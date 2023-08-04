import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import { localeCurrentDate } from '$src/lib/utils';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: router.createCaller(await createContext(event)).goals.list(1),
	intentions: router.createCaller(await createContext(event)).intentions.list({
		// Get today's date with times set to 00:00:00.000 and 23:59:59.999
		startDate: localeCurrentDate().toISOString().split('T')[0] + 'T00:00:00.000Z',
		endDate: localeCurrentDate().toISOString().split('T')[0] + 'T23:59:59.999Z'
	}),
	intentionsOnLatestDate: router
		.createCaller(await createContext(event))
		.intentions.intentionsOnLatestDate()
});
