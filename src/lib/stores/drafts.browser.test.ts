import { expect, test } from 'vitest';
import { todaysIntentions } from './todaysIntentions.js';

test('cleared intention drafts remain empty instead of falling back to the initial value', () => {
	todaysIntentions.current = '1) draft';
	expect(todaysIntentions.current).toBe('1) draft');
	todaysIntentions.current = '';
	expect(todaysIntentions.current).toBe('');
});

test('the literal text null is a draft, distinct from no draft', () => {
	todaysIntentions.current = 'null';
	expect(todaysIntentions.current).toBe('null');
	todaysIntentions.current = null;
	expect(todaysIntentions.current).toBeNull();
});
