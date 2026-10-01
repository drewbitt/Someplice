import type { Context } from '#lib/trpc/context.js';
import { transformer } from '#lib/trpc/transformer.js';
import { initTRPC, TRPCError } from '@trpc/server';
import { NoResultError } from 'kysely';

// node:sqlite failures carry a numeric `errcode`; its low byte is the primary
// result code (19 = SQLITE_CONSTRAINT, covering all extended codes such as
// CHECK/UNIQUE/NOT NULL). Those are rejections of client-supplied data.
const sqliteErrcode = (cause: unknown): number | null =>
	typeof cause === 'object' &&
	cause !== null &&
	'errcode' in cause &&
	typeof (cause as { errcode: unknown }).errcode === 'number'
		? (cause as { errcode: number }).errcode
		: null;

export const t = initTRPC.context<Context>().create({
	transformer,
	errorFormatter({ shape, error }) {
		if (error.code === 'INTERNAL_SERVER_ERROR') {
			// 500s must not hand raw driver/database text to the client; details
			// stay in the server log via the logger middleware.
			return { ...shape, message: 'Internal server error' };
		}
		return shape;
	}
});

// Maps well-known failure causes onto proper codes so a missing row is a 404
// and a rejected constraint is a 400 instead of everything being a 500.
const mapErrors = t.middleware(async ({ next }) => {
	const result = await next();
	if (result.ok) {
		return result;
	}
	const cause = result.error.cause;
	if (cause instanceof NoResultError) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found', cause });
	}
	const errcode = sqliteErrcode(cause);
	if (errcode !== null && (errcode & 0xff) === 19) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid request', cause });
	}
	return result;
});

export const procedure = t.procedure.use(mapErrors);
