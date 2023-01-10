export interface Goals {
	id: number | null;
	active: number | null;
	orderNumber: number | null;
	title: string;
	description: string | null;
	color: string | null;
}

export interface Intentions {
	id: number | null;
	goalId: number | null;
	completed: number | null;
	text: string;
	parentIntentionId: number | null;
	subIntentionQualifier: string | null;
	date: string | null;
}

export interface DB {
	goals: Goals;
	intentions: Intentions;
}
