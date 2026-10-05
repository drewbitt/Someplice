import { type RequestEvent, error } from '@sveltejs/kit';
import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { createContext } from '../context';
import { router, createCallerFactory } from '../router';

const createCaller = createCallerFactory(router);

export async function trpcLoad<Result>(
	event: RequestEvent,
	method: (caller: ReturnType<typeof createCaller>) => Promise<Result>
): Promise<Result> {
	try {
		const caller = createCaller(await createContext(event));
		return await method(caller);
	} catch (e) {
		if (e instanceof TRPCError) {
			const httpCode = getHTTPStatusCodeFromError(e);
			error(httpCode, httpCode >= 500 ? 'Internal server error' : e.message);
		}
		error(500, 'Unknown error');
	}
}
