import { t } from '$lib/trpc/t';
import { z } from 'zod';

export const goals = t.router({
	add: t.procedure.input(z.object({})).mutation(async ({ input }) => {
		console.log('test');
	})
});
