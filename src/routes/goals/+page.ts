import { trpc } from '$lib/trpc/client';
import type { PageLoad } from './$types';

export const load = (async (event) => {
	// Seed the database with some goals
	// await Promise.all([
	// 	trpc(event).goals.add.mutate({ title: 'Goal 1', description: 'This is a goal' }),
	// 	trpc(event).goals.add.mutate({ title: 'Goal 2', description: 'This is a goal' }),
	// 	trpc(event).goals.add.mutate({ title: 'Goal 3', description: 'This is a goal' })
	// ]);

	return {
		goals: await trpc(event).goals.list.query()
	};
}) satisfies PageLoad;
