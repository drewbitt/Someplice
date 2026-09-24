import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const limit = 15;

	const outcomes = await trpcLoad(event, (t) =>
		t.outcomes.list({ limit: limit, order: 'desc', orderBy: 'date' })
	);

	return {
		goals: await trpcLoad(event, (t) => t.goals.list(1)),
		intentionsByDate: await getIntentionsByDate(),
		outcomes,
		verdicts: await trpcLoad(event, (t) =>
			t.outcomes.verdictsByOutcomeIds({
				outcomeIds: outcomes.map((o) => o.id).filter((id): id is number => id !== null)
			})
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

		return await trpcLoad(event, (t) =>
			t.intentions.listByDate({
				startDate: startDate,
				endDate: endDate
			})
		);
	}
};
