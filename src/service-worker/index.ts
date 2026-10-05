import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets } from '$app/manifest';
import type { AssetPath } from '$app/types';
import { asset } from '$app/paths';

const cacheName = `someplice-${version}`;
const assetPaths = new Set([...immutable, ...assets].map(({ path }) => asset(path as AssetPath)));

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll([...assetPaths])));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith('someplice-') && key !== cacheName)
						.map((key) => caches.delete(key))
				)
			)
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	// Dynamic pages and API responses must always come from the server.
	if (
		event.request.method !== 'GET' ||
		url.origin !== self.location.origin ||
		!assetPaths.has(url.pathname)
	)
		return;
	event.respondWith(
		caches
			.open(cacheName)
			.then(async (cache) => (await cache.match(url.pathname)) ?? fetch(event.request))
	);
});
