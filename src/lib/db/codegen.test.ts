import { describe, expect, it } from 'vitest';
import { generateDbTypes } from './codegen.ts';

describe('generateDbTypes', () => {
	it('verify resolves when generated types match the schema', async () => {
		await expect(generateDbTypes(true)).resolves.toBeUndefined();
	});
});
