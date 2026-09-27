import { generate, SqliteDialect } from 'kysely-codegen';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import prettier from 'prettier';
import { createDb } from './db.ts';
import { runMigrations } from './migrate-to-latest.ts';

const OUT_FILE = './src/lib/types/data.d.ts';

/**
 * Regenerate `src/lib/types/data.d.ts` by introspecting an in-memory database
 * built from the migrations, so no real database file (or better-sqlite3) is
 * needed. With `verify`, compares the prettier-formatted output against the
 * committed file instead of writing, and throws on mismatch.
 */
export async function generateDbTypes(verify: boolean): Promise<void> {
	const db = createDb(':memory:');
	try {
		await runMigrations(db);
		const dialect = new SqliteDialect();
		if (verify) {
			// kysely-codegen's own verify diffs raw output; the committed file is
			// prettier-formatted, so format before comparing
			const newOutput = await generate({ db, dialect, outFile: null });
			const formatted = await prettier.format(newOutput, {
				...(await prettier.resolveConfig(OUT_FILE)),
				filepath: OUT_FILE
			});
			const committed = await fs.promises.readFile(OUT_FILE, 'utf8');
			if (formatted !== committed) {
				throw new Error(`${OUT_FILE} is stale. Regenerate it with: pnpm run db:codegen`);
			}
		} else {
			await generate({ db, dialect, outFile: OUT_FILE });
		}
	} finally {
		await db.destroy();
	}
}

// Run as a CLI only when invoked directly (e.g. `node ./src/lib/db/codegen.ts --verify`).
const isMainModule =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
	generateDbTypes(process.argv.includes('--verify')).catch(() => {
		process.exitCode = 1;
	});
}
