import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
	? ColumnType<S, I | undefined, U>
	: ColumnType<T, T | undefined, T>;

export interface GoalLogs {
	id: Generated<number | null>;
	goalId: number;
	type: string;
	date: string;
}

export interface Goals {
	id: Generated<number | null>;
	active: number;
	orderNumber: number;
	title: string;
	description: string | null;
	color: string;
}

export interface Intentions {
	id: Generated<number | null>;
	orderNumber: number;
	completed: number;
	text: string;
	subIntentionQualifier: string | null;
	date: string;
	goalId: number;
}

export interface Outcomes {
	id: Generated<number | null>;
	reviewed: number;
	date: string;
}

export interface OutcomesIntentions {
	outcomeId: number;
	intentionId: number;
}

export interface DB {
	goal_logs: GoalLogs;
	goals: Goals;
	intentions: Intentions;
	outcomes: Outcomes;
	outcomes_intentions: OutcomesIntentions;
}
