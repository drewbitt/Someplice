import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import { localeCurrentDate } from '$src/lib/utils';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: router.createCaller(await createContext(event)).goals.list(1),
	intentions: router.createCaller(await createContext(event)).intentions.list({
		startDate: localeCurrentDate(),
		endDate: localeCurrentDate()
	}),
	intentionsOnLatestDate: router
		.createCaller(await createContext(event))
		.intentions.intentionsOnLatestDate()
});
