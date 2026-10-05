import type { HandleClientError } from '@sveltejs/kit/hooks';
import { appLogger } from '#lib/utils/logger.js';

export const handleError: HandleClientError = ({ error, event }) => {
	const errorId = crypto.randomUUID();

	appLogger.error(`Error ID: ${errorId}`, error, event);

	return {
		message: 'Whoops!',
		errorId
	};
};
