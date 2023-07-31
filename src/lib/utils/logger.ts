import { Logger } from 'tslog';

export const appLogger = new Logger({ name: 'appLogger' });
export const dbLogger = new Logger({ name: 'dbLogger' });
export const trpcLogger = new Logger({
	name: 'trpcLogger',
	hideLogPositionForProduction: true,
	prettyLogTemplate: '{{name}} '
});
export const cronLogger = new Logger({ name: 'cronLogger' });

// Default logger
export const logger = new Logger({ name: 'logger' });
