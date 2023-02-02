import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
	? ColumnType<S, I | undefined, U>
	: ColumnType<T, T | undefined, T>;

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
	goalId: number;
	completed: number;
	text: string;
	parentIntentionId: number;
	subIntentionQualifier: string;
	date: string;
}

export interface DB {
	goals: Goals;
	intentions: Intentions;
}
