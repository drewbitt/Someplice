import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: router.createCaller(await createContext(event)).goals.list(),
	inactiveGoals: router.createCaller(await createContext(event)).goals.list(0)
});
