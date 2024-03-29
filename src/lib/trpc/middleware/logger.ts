import { t } from '$lib/trpc/t';
import { trpcLogger } from '$src/lib/utils/logger';

export const logger = t.middleware(async ({ path, type, next }) => {
	const start = Date.now();
	const result = await next();
	const ms = Date.now() - start;
	trpcLogger.debug(`${result.ok ? 'OK' : 'ERR'} ${type} ${path} - ${ms}ms`);
	if (!result.ok) {
		if (process.env.NODE_ENV === 'test') {
			trpcLogger.error(
				`Got error in test environment. Message: ${result.error.message}, Code: ${result.error.code}`
			);
		} else {
			trpcLogger.error(result.error);
		}
	}
	return result;
});
