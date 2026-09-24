import type { z } from 'zod';
import type { GoalLogSchema } from './routes/goal_logs';
import type { GoalSchema } from './routes/goals';
import type { IntentionsSchema } from './routes/intentions';
import type { OutcomeSchema } from './routes/outcomes';
import type { PrioritySchema } from './routes/priorities';

export type Goal = z.infer<typeof GoalSchema>;
export type Intention = z.infer<typeof IntentionsSchema>;
export type GoalLog = z.infer<typeof GoalLogSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Priority = z.infer<typeof PrioritySchema>;

/** A priority row joined with the display fields of its goal. */
export type PriorityWithGoal = Priority & {
	goalTitle: string;
	goalColor: string;
	goalOrderNumber: number;
};
