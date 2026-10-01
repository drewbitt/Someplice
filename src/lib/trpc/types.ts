import type { Selectable } from 'kysely';
import type { OutcomeVerdicts, Priorities } from '#src/lib/types/data.js';
import type { z } from 'zod';
import type { GoalLogSchema } from './routes/goal_logs';
import type { GoalSchema } from './routes/goals';
import type { IntentionsSchema } from './routes/intentions';
import type { OutcomeSchema, VerdictSchema } from './routes/outcomes';

export type Goal = z.infer<typeof GoalSchema>;
export type Intention = z.infer<typeof IntentionsSchema>;
export type IntentionStatus = Intention['status'];
export type GoalLog = z.infer<typeof GoalLogSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type VerdictValue = Verdict['verdict'];
export type OutcomeVerdict = Selectable<OutcomeVerdicts>;
export type Priority = Selectable<Priorities>;
