import { describe, expect, it, vi } from 'vitest';
import { PersistedState } from 'runed';
import theme from './theme.ts';
import { createTodaysIntentions, todaysIntentions } from './todaysIntentions.ts';
import { goalPageErrorStore, todayPageErrorStore } from './errors.svelte.ts';

const stringSerializer = {
	serialize: (v: string) => v,
	deserialize: (v: string) => v
};

const fakeWindow = () => {
	const store = new Map<string, string>();
	return {
		localStorage: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => store.set(k, v),
			removeItem: (k: string) => store.delete(k)
		},
		addEventListener: () => null,
		removeEventListener: () => null,
		store
	};
};

describe('stores', () => {
	it('timed error stores set and clear after the timeout', () => {
		vi.useFakeTimers();
		try {
			goalPageErrorStore.setError('boom');
			expect(goalPageErrorStore.current).toBe('boom');
			vi.advanceTimersByTime(6000);
			expect(goalPageErrorStore.current).toBeNull();

			todayPageErrorStore.setError(null);
			expect(todayPageErrorStore.current).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('theme and intentions defaults are readable without a browser', () => {
		// PersistedState treats storage as source of truth; writes drop headless
		expect(theme.current).toBe('light');
		expect(todaysIntentions.current).toBeNull();
	});

	it('PersistedState writes raw strings, preserving the localStorage format', () => {
		const w = fakeWindow();
		const state = new PersistedState('theme', 'light', {
			serializer: stringSerializer,
			// @ts-expect-error minimal window stub
			window: w
		});
		state.current = 'dark';
		expect(w.store.get('theme')).toBe('dark');
	});

	it('PersistedState reads an existing raw value', () => {
		const w = fakeWindow();
		w.store.set('todaysIntentions', 'hello');
		const state = new PersistedState('todaysIntentions', '', {
			serializer: stringSerializer,
			// @ts-expect-error minimal window stub
			window: w
		});
		expect(state.current).toBe('hello');
	});

	it.each(['legacy draft', '', '"quoted"', '{"value":1}', '0'])(
		'migrates the legacy raw draft %j without interpreting it as JSON',
		(draft) => {
			const w = fakeWindow();
			w.store.set('todaysIntentions', draft);
			// @ts-expect-error minimal window stub
			const state = createTodaysIntentions(w);
			expect(state.current).toBe(draft);
		}
	);

	it.each(['', 'null', null])('preserves the new draft %j across recreation', (draft) => {
		const w = fakeWindow();
		w.store.set('todaysIntentions', 'stale legacy draft');
		// @ts-expect-error minimal window stub
		const state = createTodaysIntentions(w);
		state.current = draft;
		expect(state.current).toBe(draft);
		// @ts-expect-error minimal window stub
		expect(createTodaysIntentions(w).current).toBe(draft);
	});

	it('migrates the legacy no-draft sentinel as null', () => {
		const w = fakeWindow();
		w.store.set('todaysIntentions', 'null');
		// @ts-expect-error minimal window stub
		expect(createTodaysIntentions(w).current).toBeNull();
	});
});
