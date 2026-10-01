import { goal_logs } from '#lib/trpc/routes/goal_logs.js';
import { goals } from '#lib/trpc/routes/goals.js';
import { intentions } from '#lib/trpc/routes/intentions.js';
import { outcomes } from '#lib/trpc/routes/outcomes.js';
import { priorities } from '#lib/trpc/routes/priorities.js';
import { settings } from '#lib/trpc/routes/settings.js';
import { t } from '#lib/trpc/t.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

const { createCallerFactory } = t;

export const router = t.router({
	goals,
	intentions,
	goal_logs,
	outcomes,
	priorities,
	settings
});

export type Router = typeof router;

// 👇 type helpers 💡
export type RouterInputs = inferRouterInputs<Router>;
export type RouterOutputs = inferRouterOutputs<Router>;

export { createCallerFactory };
