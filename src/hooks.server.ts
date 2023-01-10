import { getCssText } from '@svelteuidev/core';
import type { Handle } from '@sveltejs/kit';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { migrateToLatest } from '$db/migrate-to-latest';

export const handle = (async ({ event, resolve }) => {
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
