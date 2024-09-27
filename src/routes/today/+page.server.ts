import { localeCurrentDate } from '$src/lib/utils';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trpcLoad } from '$src/lib/trpc/middleware/trpc-load';

export const load: PageServerLoad = async (event: ServerLoadEvent) => ({
	goals: await trpcLoad(event, (t) => t.goals.list(1)),
	intentions: await trpcLoad(event, (t) =>
		t.intentions.list({
			startDate: localeCurrentDate(),
			endDate: localeCurrentDate()
		})
	),
	intentionsOnLatestDate: await trpcLoad(event, (t) => t.intentions.intentionsOnLatestDate())
});
