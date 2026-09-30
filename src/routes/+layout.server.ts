import { getConfiguredTimeZone } from '$src/lib/db/queries';
import { getDb } from '$src/lib/db/db';
import type { LayoutServerLoad } from './$types';

// The installation timezone the client renders day boundaries in — the same
// zone the server's day math uses.
export const load: LayoutServerLoad = async () => {
	return { timeZone: await getConfiguredTimeZone(getDb()) };
};
