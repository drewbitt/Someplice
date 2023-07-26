import type { Context } from '$lib/trpc/context';
import { transformer } from '$lib/trpc/transformer';
import { initTRPC } from '@trpc/server';

export const t = initTRPC.context<Context>().create({
	transformer
});
