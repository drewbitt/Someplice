import type { z } from 'zod';
import type { GoalLogSchema } from './routes/goal_logs';
import type { GoalSchema } from './routes/goals';
import type { IntentionsSchema } from './routes/intentions';

export type Goal = z.infer<typeof GoalSchema>;
export type Intention = z.infer<typeof IntentionsSchema>;
export type GoalLog = z.infer<typeof GoalLogSchema>;
