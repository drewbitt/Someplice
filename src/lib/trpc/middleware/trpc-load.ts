import { type RequestEvent, error } from '@sveltejs/kit';
import { TRPCError } from '@trpc/server';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { createContext } from '../context';
import { router } from '../router';

export async function trpcLoad<
	Event extends RequestEvent<Partial<Record<string, string>>, string | null>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Method extends (caller: ReturnType<typeof router.createCaller>) => Promise<any>
>(event: Event, method: Method): Promise<ReturnType<Method>> {
	try {
		const caller = router.createCaller(await createContext(event));
		return await method(caller);
	} catch (e) {
		if (e instanceof TRPCError) {
			const httpCode = getHTTPStatusCodeFromError(e);

			throw error(httpCode, e.message);
		}

		throw error(500, 'Unknown error');
	}
}
