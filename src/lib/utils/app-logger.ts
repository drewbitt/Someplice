import { LiteLogger } from 'tslog/lite';

// Client errors need native Error objects and caller locations, not the full
// server logger's formatting, transports, and metadata machinery.
export const appLogger = new LiteLogger({ name: 'appLogger' });
