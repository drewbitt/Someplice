import { trpc } from '$lib/trpc/client';
import type { PageLoad } from './$types';

// Seed some goals
// eslint-disable-next-line no-empty-pattern
export const load = (async (event) => {
	await Promise.all([
		trpc(event).goals.add.mutate({ title: 'Goal 1', description: 'This is a goal' }),
		trpc(event).goals.add.mutate({ title: 'Goal 2', description: 'This is a goal' }),
		trpc(event).goals.add.mutate({ title: 'Goal 3', description: 'This is a goal' })
	]);

	return {
		goals: [
			{
				id: 1,
				title: 'Goal 1',
				description: 'This is a goal'
			},
			{
				id: 2,
				title: 'Goal 2',
				description: 'This is a goal'
			},
			{
				id: 3,
				title: 'Goal 3',
				description: 'This is a goal'
			}
		]
	};
}) satisfies PageLoad;
