import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '../today/$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;

	const intentionsInRange = await getIntentionsWithPagination();

	return {
		goals: trpcLoad(event, (t) => t.goals.list(1)),
		intentionsByDate: intentionsInRange,
		outcomes: trpcLoad(event, (t) => t.outcomes.list({ limit: limit, order: 'desc' }))
	};

	/**
	 * Paginate with listUniqueDates and load intentions in range with listByDate
	 */
	async function getIntentionsWithPagination() {
		const uniqueDatesResult = await trpcLoad(event, (t) =>
			t.intentions.listUniqueDates({
				limit: limit
			})
		);
		const uniqueDates = uniqueDatesResult.map((d) => d.date);

		// If there are no unique dates, then there's nothing to paginate.
		if (uniqueDates.length === 0) {
			throw new Error('No unique dates received.'); // TODO: Handle this error case?
		}

		const endDate = new Date(uniqueDates[0]);
		const startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		// Ensure the dates are valid before proceeding.
		if (Number.isNaN(endDate.getTime()) || Number.isNaN(startDate.getTime())) {
			throw new Error('Invalid dates received.'); // TODO: Handle this error case?
		}

		const intentionsInRange = await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);
		return intentionsInRange;
	}
};
