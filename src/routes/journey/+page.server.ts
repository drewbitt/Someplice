import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '../today/$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;

	return {
		goals: trpcLoad(event, (t) => t.goals.list(1)),
		intentionsByDate: getIntentionsByDate(),
		// Gets limit of the most recent outcomes
		outcomes: trpcLoad(event, (t) => t.outcomes.list({ limit: limit, order: 'desc' }))
	};

	async function getIntentionsByDate() {
		// Gets limit of the most recent unique dates
		const uniqueDatesResult = await trpcLoad(event, (t) =>
			t.intentions.listUniqueDates({ limit: limit })
		);
		const uniqueDates = uniqueDatesResult.map((d) => d.date);

		// If there are no unique dates, then there's nothing to paginate.
		if (uniqueDates.length === 0) {
			throw new Error('No unique dates received.');
		}

		const endDate = new Date(uniqueDates[0]);
		const startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		// Ensure the dates are valid before proceeding.
		if (Number.isNaN(endDate.getTime()) || Number.isNaN(startDate.getTime())) {
			throw new Error('Invalid dates received.');
		}

		return trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);
	}
};
