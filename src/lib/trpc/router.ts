import { goal_logs } from '$lib/trpc/routes/goal_logs';
import { goals } from '$lib/trpc/routes/goals';
import { intentions } from '$lib/trpc/routes/intentions';
import { t } from '$lib/trpc/t';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

export const router = t.router({
	goals,
	intentions,
	goal_logs
});

export type Router = typeof router;

// 👇 type helpers 💡
export type RouterInputs = inferRouterInputs<Router>;
export type RouterOutputs = inferRouterOutputs<Router>;
