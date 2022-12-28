import { getCssText } from '@svelteuidev/core';

export const handle = async ({ event, resolve }) => {
	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			const headEndIndex = html.indexOf('</head>');
			const returnHtml =
				`${html.slice(0, headEndIndex)}<style id="stitches">${getCssText()}</style>${html.slice(headEndIndex)}`;
			return returnHtml;
		}
	});
};
