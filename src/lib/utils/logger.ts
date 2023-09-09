import { Logger } from 'tslog';
/* Log levels
0: Silly
1: Trace
2: Debug
3: Info
4: Warn
5: Error
6: Fatal */
export const appLogger = new Logger({ name: 'appLogger' });
export const dbLogger = new Logger({
	name: 'dbLogger',
	minLevel: process.env.NODE_ENV === 'test' ? 3 : 1
});
export const trpcLogger = new Logger({
	name: 'trpcLogger',
	hideLogPositionForProduction: true,
	prettyLogTemplate: '{{name}} ',
	minLevel: import.meta.env.PROD || process.env.NODE_ENV === 'test' ? 4 : 1
});
export const cronLogger = new Logger({
	name: 'cronLogger',
	minLevel: import.meta.env.PROD ? 3 : 1
});

// Default logger
export const logger = new Logger({ name: 'logger' });
