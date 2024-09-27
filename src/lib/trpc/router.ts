import { goal_logs } from '$lib/trpc/routes/goal_logs';
import { goals } from '$lib/trpc/routes/goals';
import { intentions } from '$lib/trpc/routes/intentions';
import { outcomes } from '$lib/trpc/routes/outcomes';
import { t } from '$lib/trpc/t';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

const { createCallerFactory } = t;

export const router = t.router({
	goals,
	intentions,
	goal_logs,
	outcomes
});

export type Router = typeof router;

// 👇 type helpers 💡
export type RouterInputs = inferRouterInputs<Router>;
export type RouterOutputs = inferRouterOutputs<Router>;

export { createCallerFactory };
