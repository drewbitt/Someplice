import { createServer, request } from 'node:http';
import { once } from 'node:events';

export async function createNetworkSwitch(target: string) {
	let online = true;
	const server = createServer((incoming, outgoing) => {
		if (!online) {
			incoming.socket.destroy();
			return;
		}
		const upstream = request(
			new URL(incoming.url ?? '/', target),
			{
				method: incoming.method,
				headers: incoming.headers
			},
			(response) => {
				outgoing.writeHead(response.statusCode ?? 502, response.headers);
				response.pipe(outgoing);
			}
		);
		upstream.on('error', () => outgoing.destroy());
		incoming.on('aborted', () => upstream.destroy());
		incoming.pipe(upstream);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
	return {
		url: `http://localhost:${address.port}`,
		goOffline: () => {
			online = false;
		},
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()));
				server.closeAllConnections();
			})
	};
}
