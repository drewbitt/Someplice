import { trpc } from '$lib/trpc/client';
import type { PageLoad } from './$types';

export const load = (async (event) => {
	return {
		goals: await trpc(event).goals.list.query()
	};
}) satisfies PageLoad;
