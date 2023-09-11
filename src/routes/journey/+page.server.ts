import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from '../today/$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;

	return {
		goals: trpcLoad(event, (t) => t.goals.list(1)),
		intentionsByDate: await getIntentionsByDate(),
		outcomes: trpcLoad(event, (t) =>
			t.outcomes.list({ limit: limit, order: 'desc', orderBy: 'date' })
		)
	};

	async function getIntentionsByDate() {
		const uniqueDatesResult = await trpcLoad(event, (t) =>
			t.intentions.listUniqueDates({ limit: limit })
		);
		const uniqueDates = uniqueDatesResult.map((d) => d.date);

		let endDate = new Date(uniqueDates[0]);
		let startDate = new Date(uniqueDates[uniqueDates.length - 1]);

		// At least ensure that the dates are valid
		if (Number.isNaN(endDate.getTime())) {
			endDate = new Date();
		}
		if (Number.isNaN(startDate.getTime())) {
			startDate = new Date();
		}

		return trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);
	}
};
