import type { RequestEvent } from '@sveltejs/kit';
import { TRPCError } from '@trpc/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { trpcLoad } from './trpc-load';

const event = {} as RequestEvent;

describe('trpcLoad', () => {
	it('preserves the resolved result type', async () => {
		const result = trpcLoad(event, async () => ({ id: 1, title: 'Goal' }));
		expectTypeOf(result).toEqualTypeOf<Promise<{ id: number; title: string }>>();
		expect(await result).toEqual({ id: 1, title: 'Goal' });
	});

	it('preserves actionable client errors and their HTTP status', async () => {
		await expect(
			trpcLoad(event, async () => {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Goal not found' });
			})
		).rejects.toMatchObject({ status: 404, body: { message: 'Goal not found' } });
	});

	it('does not expose internal tRPC errors in server load responses', async () => {
		await expect(
			trpcLoad(event, async () => {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'SQLite failed at /private/data/database.sqlite'
				});
			})
		).rejects.toMatchObject({ status: 500, body: { message: 'Internal server error' } });
	});

	it('does not expose unexpected errors in server load responses', async () => {
		await expect(
			trpcLoad(event, async () => {
				throw new Error('Private database detail');
			})
		).rejects.toMatchObject({ status: 500, body: { message: 'Unknown error' } });
	});
});
