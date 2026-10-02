import { browser } from '$app/env';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { Router } from '#lib/trpc/router.js';
import { transformer } from '#lib/trpc/transformer.js';

let browserClient: ReturnType<typeof createTRPCClient<Router>>;

export function trpc() {
	if (browser && browserClient) return browserClient;

	const client = createTRPCClient<Router>({
		links: [
			httpBatchLink({
				url: browser ? '/api/trpc' : 'http://localhost:5173/api/trpc',
				transformer
			})
		]
	});

	if (browser) browserClient = client;
	return client;
}
