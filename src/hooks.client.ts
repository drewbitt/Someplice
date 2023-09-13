import type { HandleClientError } from '@sveltejs/kit';
import { todaysIntentionsStore } from './lib/stores/localStorage';
import { appLogger } from './lib/utils/logger';

// Clear on application restart
// Only clear in production as dev mode HMR will cause this to run on every file change
if (import.meta.env.PROD) {
	todaysIntentionsStore.clear();
}

export const handleError: HandleClientError = async ({ error, event }) => {
	const errorId = crypto.randomUUID();

	appLogger.error(`Error ID: ${errorId}`, error, event);

	return {
		message: 'Whoops!',
		errorId
	};
};
