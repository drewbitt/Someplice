import { expect, test } from '@playwright/test';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { DeleteResult, UpdateResult } from 'kysely';
import type { Router } from '../src/lib/trpc/router';
import { transformer } from '../src/lib/trpc/transformer';
import { openTestDb, resetTestDb } from './fixtures';

const endpoint = '/api/trpc';
test.beforeEach(resetTestDb);

function client(baseURL: string) {
	const responses: Response[] = [];
	const api = createTRPCClient<Router>({
		links: [
			httpBatchLink({
				url: `${baseURL}${endpoint}`,
				transformer,
				fetch: async (url, options) => {
					const response = await fetch(url, options);
					responses.push(response.clone());
					return response;
				}
			})
		]
	});
	return { api, responses };
}

function seedIntention() {
	const db = openTestDb();
	try {
		db.prepare(
			"INSERT INTO goals(id,active,orderNumber,title,color) VALUES(1,1,1,'Read','navy')"
		).run();
		db.prepare(
			"INSERT INTO intentions(id,goalId,orderNumber,status,text,date) VALUES(1,1,1,'pending','Read','2026-01-02T12:00:00.000Z')"
		).run();
	} finally {
		db.close();
	}
}

function decodeError(body: { error: string }) {
	return transformer.output.deserialize(body.error) as {
		message: string;
		data: { code: string; httpStatus: number; stack?: string };
	};
}

test('HTTP batches queries and round-trips Date inputs', async ({ baseURL }) => {
	seedIntention();
	const { api, responses } = client(baseURL!);
	const [zone, goals, intentions] = await Promise.all([
		api.settings.getTimeZone.query(),
		api.goals.list.query(),
		api.intentions.list.query({
			startDate: new Date('2026-01-02T00:00:00Z'),
			endDate: new Date('2026-01-02T00:00:00Z')
		})
	]);
	expect(zone).toBe('UTC');
	expect(goals).toMatchObject([{ id: 1, title: 'Read' }]);
	expect(intentions).toMatchObject([{ id: 1, text: 'Read' }]);
	expect(responses).toHaveLength(1);
	expect(responses[0].status).toBe(200);
	expect(new URL(responses[0].url).searchParams.get('batch')).toBe('1');
	expect(responses[0].headers.get('content-type')).toContain('application/json');
});

test('HTTP preserves zero/nonzero Kysely results and bigint metadata', async ({ baseURL }) => {
	seedIntention();
	const { api } = client(baseURL!);
	const zero = await api.priorities.clear.mutate({ goalId: 1 });
	expect(zero).toBeInstanceOf(DeleteResult);
	expect(zero.numDeletedRows).toBe(0n);
	await api.priorities.upsert.mutate({ goalId: 1, text: 'Read' });
	const one = await api.priorities.clear.mutate({ goalId: 1 });
	expect(one).toBeInstanceOf(DeleteResult);
	expect(one.numDeletedRows).toBe(1n);
	const update = await api.intentions.setStatus.mutate({ ids: [1], status: 'done' });
	expect(update).toBeInstanceOf(UpdateResult);
	expect(update.numUpdatedRows).toBe(1n);
});

test('HTTP mixed batches retain successful queries and report individual validation errors', async ({
	baseURL
}) => {
	const { api, responses } = client(baseURL!);
	const [valid, invalid] = await Promise.allSettled([
		api.settings.getTimeZone.query(),
		api.outcomes.list.query({ limit: -1 })
	]);
	expect(valid).toEqual({ status: 'fulfilled', value: 'UTC' });
	expect(invalid.status).toBe('rejected');
	if (invalid.status === 'rejected') {
		expect(invalid.reason).toBeInstanceOf(TRPCClientError);
		expect(invalid.reason.data).toMatchObject({ code: 'BAD_REQUEST', httpStatus: 400 });
	}
	expect(responses).toHaveLength(1);
	expect(responses[0].status).toBe(207);
});

test('HTTP uses 404 for missing rows and 400 for SQLite constraint failures', async ({
	baseURL
}) => {
	const { api, responses } = client(baseURL!);
	await expect(api.intentions.delete.mutate(999)).rejects.toMatchObject({
		data: { code: 'NOT_FOUND', httpStatus: 404 }
	});
	expect(responses.at(-1)?.status).toBe(404);
	await expect(
		api.priorities.upsert.mutate({ goalId: 999, text: 'Missing goal' })
	).rejects.toMatchObject({
		message: 'Invalid request',
		data: { code: 'BAD_REQUEST', httpStatus: 400 }
	});
	expect(responses.at(-1)?.status).toBe(400);
});

test('HTTP rejects malformed JSON and malformed serialized input as client errors', async ({
	request
}) => {
	for (const input of ['not-json', JSON.stringify('not-devalue'), '{}']) {
		const response = await request.get(`${endpoint}/goals.list`, { params: { input } });
		const error = decodeError(await response.json());
		expect(response.status(), `${input}: ${JSON.stringify(error)}`).toBe(400);
		expect(error.data.httpStatus).toBe(400);
		expect(error.data.code).toBe('BAD_REQUEST');
	}
});

test('HTTP rejects mutations over GET and unsupported POST content types without writing', async ({
	request,
	baseURL
}) => {
	const input = JSON.stringify(transformer.input.serialize({ timeZone: 'Asia/Tokyo' }));
	const get = await request.get(`${endpoint}/settings.setTimeZone`, { params: { input } });
	expect(get.status()).toBe(405);
	expect(decodeError(await get.json()).data.code).toBe('METHOD_NOT_SUPPORTED');
	const post = await request.post(`${endpoint}/settings.setTimeZone`, {
		data: 'plain text',
		headers: { 'Content-Type': 'application/xml', Origin: baseURL! }
	});
	expect(post.status()).toBe(415);
	expect(decodeError(await post.json()).data.code).toBe('UNSUPPORTED_MEDIA_TYPE');
	expect(await client(baseURL!).api.settings.getTimeZone.query()).toBe('UTC');
});

test('HTTP does not route adjacent path prefixes to tRPC procedures', async ({ request }) => {
	for (const path of ['/api/trpcsettings.getTimeZone', '/api/trpcgoals.list']) {
		const response = await request.get(path);
		expect(response.status()).toBe(404);
	}
});

test('HTTP rejects cross-origin form submissions without writing', async ({ request, baseURL }) => {
	const response = await request.post(`${endpoint}/settings.setTimeZone`, {
		data: 'timeZone=Asia%2FTokyo',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Origin: 'https://other.invalid'
		}
	});
	expect(response.status()).toBe(403);
	expect(await client(baseURL!).api.settings.getTimeZone.query()).toBe('UTC');
});

test('HTTP does not expose internal SQLite errors or production stacks', async ({ baseURL }) => {
	seedIntention();
	const db = openTestDb();
	try {
		db.exec(
			'CREATE TRIGGER fail_status BEFORE UPDATE ON intentions BEGIN SELECT private_error_marker(); END;'
		);
	} finally {
		db.close();
	}
	try {
		const { api, responses } = client(baseURL!);
		await expect(
			api.intentions.setStatus.mutate({ ids: [1], status: 'done' })
		).rejects.toMatchObject({
			message: 'Internal server error',
			data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 }
		});
		const response = responses.at(-1)!;
		expect(response.status).toBe(500);
		const body = await response.json();
		const error = decodeError(body[0]);
		expect(error.data.stack).toBeUndefined();
		expect(JSON.stringify(error)).not.toContain('private_error_marker');
	} finally {
		const db = openTestDb();
		try {
			db.exec('DROP TRIGGER fail_status');
		} finally {
			db.close();
		}
	}
});

test('HTTP partial batch cancellation leaves live calls usable', async ({ baseURL }) => {
	const { api, responses } = client(baseURL!);
	const controller = new AbortController();
	const pending = api.outcomes.list.query(undefined, { signal: controller.signal });
	const healthy = api.settings.getTimeZone.query();
	const results = Promise.allSettled([pending, healthy]);
	controller.abort();
	const [cancelled, completed] = await results;
	expect(cancelled).toEqual({ status: 'fulfilled', value: [] });
	expect(completed).toEqual({ status: 'fulfilled', value: 'UTC' });
	expect(responses).toHaveLength(1);
	expect(responses[0].status).toBe(200);
});

test('HTTP cancels a batch when its only call is aborted', async ({ baseURL }) => {
	const { api, responses } = client(baseURL!);
	const controller = new AbortController();
	const pending = api.settings.getTimeZone.query(undefined, { signal: controller.signal });
	const result = Promise.allSettled([pending]);
	controller.abort();
	expect((await result)[0].status).toBe('rejected');
	expect(responses).toHaveLength(0);
});
