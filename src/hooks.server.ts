import { getCssText } from '@svelteuidev/core';
import type { Handle } from '@sveltejs/kit';
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import { createTRPCHandle } from 'trpc-sveltekit';
import { sequence } from '@sveltejs/kit/hooks';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { migrateToLatest } from '$db/migrate-to-latest';

export const trpcHandle: Handle = createTRPCHandle({ router, createContext });

export const sveltuiHandle = (async ({ event, resolve }) => {
	return await resolve(event, {
		transformPageChunk: ({ html }: { html: string }): string => {
			const headEndIndex = html.indexOf('</head>');
			const returnHtml = `${html.slice(
				0,
				headEndIndex
			)}<style id="stitches">${getCssText()}</style>${html.slice(headEndIndex)}`;
			return returnHtml;
		}
	});
}) satisfies Handle;

export const handle = sequence(trpcHandle, sveltuiHandle);
