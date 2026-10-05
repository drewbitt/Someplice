import { rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { FullConfig } from '@playwright/test';

export default function teardown(config: FullConfig) {
	const directory = resolve(config.metadata.databaseDirectory);
	if (
		dirname(directory) !== resolve(tmpdir()) ||
		!basename(directory).startsWith('someplice-e2e-')
	) {
		throw new Error('Refusing to remove a directory that is not an E2E database directory.');
	}
	rmSync(directory, { recursive: true, force: true });
}
