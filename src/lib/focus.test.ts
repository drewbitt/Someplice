import { afterEach, expect, it, vi } from 'vitest';
import { createSessionId, elapsedSeconds, formatClock } from './focus.js';

afterEach(() => vi.unstubAllGlobals());

it('can create retry IDs on HTTP LAN installations without randomUUID', () => {
	const getRandomValues = crypto.getRandomValues.bind(crypto);
	vi.stubGlobal('crypto', { getRandomValues });
	const first = createSessionId();
	expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	expect(createSessionId()).not.toBe(first);
});

it('clamps clock skew and oversleep while rounding display time upwards', () => {
	const session = { plannedSeconds: 60, elapsedSeconds: 10, lastStartedAt: 1000 };
	expect(elapsedSeconds(session, 0)).toBe(10);
	expect(elapsedSeconds(session, 100_000)).toBe(60);
	expect(formatClock(59.1)).toBe('01:00');
	expect(formatClock(-1)).toBe('00:00');
});
