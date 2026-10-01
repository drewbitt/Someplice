import { building } from '$app/env';
import { getConfiguredTimeZone } from '#src/lib/db/queries.js';
import { getDb } from '#src/lib/db/db.js';
import type { LayoutServerLoad } from './$types';

// The installation timezone the client renders day boundaries in — the same
// zone the server's day math uses. Prerendering runs with no migrated
// database, so the client resolves the zone on mount instead.
export const load: LayoutServerLoad = async () => {
	return { timeZone: building ? null : await getConfiguredTimeZone(getDb()) };
};
