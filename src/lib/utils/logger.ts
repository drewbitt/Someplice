import { Logger } from 'tslog';

export const appLogger = new Logger({ name: 'appLogger' });
export const dbLogger = new Logger({
	name: 'dbLogger',
	minLevel: process.env.NODE_ENV === 'test' ? 3 : 1
});
export const trpcLogger = new Logger({
	name: 'trpcLogger',
	hideLogPositionForProduction: true,
	prettyLogTemplate: '{{name}} ',
	minLevel: process.env.NODE_ENV === 'test' ? 3 : 1
});
export const cronLogger = new Logger({ name: 'cronLogger' });

// Default logger
export const logger = new Logger({ name: 'logger' });
