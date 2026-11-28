import { getDb } from '#lib/db/db.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	await getDb().selectFrom('settings').select('key').limit(1).executeTakeFirst();
	return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
