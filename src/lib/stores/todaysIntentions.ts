import { PersistedState } from 'runed';

// JSON keeps an empty draft, the literal text "null", and no draft distinct.
// A new key lets us migrate raw legacy text without guessing whether text such
// as '"quoted"' or '{"value":1}' was already JSON. Keep the old key for old tabs.
export function createTodaysIntentions(
	browser: typeof window | undefined = typeof window === 'undefined' ? undefined : window
) {
	const legacy = browser?.localStorage.getItem('todaysIntentions');
	return new PersistedState<string | null>(
		'todaysIntentions:v2',
		legacy === 'null' ? null : (legacy ?? null),
		{ window: browser }
	);
}

export const todaysIntentions = createTodaysIntentions();
