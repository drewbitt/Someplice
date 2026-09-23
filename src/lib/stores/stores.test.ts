import { describe, expect, it, vi } from 'vitest';
import { PersistedState } from 'runed';
import theme from './theme.ts';
import { todaysIntentions } from './todaysIntentions.ts';
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
		// runed's PersistedState treats storage as the source of truth, so
		// writes are dropped headless — defaults are all that is observable here.
		expect(theme.current).toBe('light');
		expect(todaysIntentions.current).toBe('');
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
});
