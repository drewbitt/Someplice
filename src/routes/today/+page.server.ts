import { localeCurrentDate } from '$src/lib/utils';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';

export const load: PageServerLoad = async (event: ServerLoadEvent) => {
	const [goals, intentions, intentionsOnLatestDate] = await Promise.all([
		trpcLoad(event, (t) => t.goals.list(1)),
		trpcLoad(event, (t) =>
			t.intentions.list({
				startDate: localeCurrentDate(),
				endDate: localeCurrentDate()
			})
		),
		trpcLoad(event, (t) => t.intentions.intentionsOnLatestDate())
	]);
	return { goals, intentions, intentionsOnLatestDate };
};
