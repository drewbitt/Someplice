import type { HandleClientError } from '@sveltejs/kit/hooks';
import { todaysIntentions } from '#lib/stores/todaysIntentions.js';
import { appLogger } from '#lib/utils/logger.js';

// Clear on application restart
// Only clear in production as dev mode HMR will cause this to run on every file change
if (import.meta.env.PROD) {
	todaysIntentions.current = null;
}

export const handleError: HandleClientError = ({ error, event }) => {
	const errorId = crypto.randomUUID();

	appLogger.error(`Error ID: ${errorId}`, error, event);

	return {
		message: 'Whoops!',
		errorId
	};
};
