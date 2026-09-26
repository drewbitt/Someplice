import type { z } from 'zod';
import type { GoalLogSchema } from './routes/goal_logs';
import type { GoalSchema } from './routes/goals';
import type { IntentionsSchema } from './routes/intentions';
import type { OutcomeSchema, VerdictSchema } from './routes/outcomes';

export type Goal = z.infer<typeof GoalSchema>;
export type Intention = z.infer<typeof IntentionsSchema>;
export type GoalLog = z.infer<typeof GoalLogSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type OutcomeVerdict = z.infer<typeof VerdictSchema>;
export type VerdictValue = OutcomeVerdict['verdict'];
