import { DbInstance } from '$src/lib/db/db';
import { runMigrations } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import type { Kysely } from 'kysely';
import { beforeEach, describe, expect, it } from 'vitest';
import { localeCurrentDate, localePreviousDate } from '$src/lib/utils';
import { checkMissingOutcomes } from './cron';

const TEST_GOAL = {
	active: 1,
	title: 'Test Goal',
	description: 'A goal for testing purposes.',
	color: 'hsl(0, 0%, 50%)',
	orderNumber: 1
};

const insertGoal = async (db: Kysely<DB>) => {
	const goal = await db
		.insertInto('goals')
		.values(TEST_GOAL)
		.returning('id')
		.executeTakeFirstOrThrow();
	return goal.id as number;
};

const insertIntention = async (
	db: Kysely<DB>,
	goalId: number,
	date: string,
	orderNumber: number
) => {
	const intention = await db
		.insertInto('intentions')
		.values({
			goalId,
			orderNumber,
			completed: 0,
			text: 'test intention',
			subIntentionQualifier: null,
			date
		})
		.returning('id')
		.executeTakeFirstOrThrow();
	return intention.id as number;
};

describe('checkMissingOutcomes', () => {
	let db: Kysely<DB>;

	beforeEach(async () => {
		const dbInstance = DbInstance.getInstance();
		dbInstance.setNewTestDb();
		db = dbInstance.db;
		await runMigrations(db);
	});

	it('creates an outcome and links for days that only have intentions', async () => {
		const goalId = await insertGoal(db);
		await insertIntention(db, goalId, '2023-07-01T00:01:00.000Z', 1);
		await insertIntention(db, goalId, '2023-07-01T00:02:00.000Z', 2);

		await checkMissingOutcomes();

		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(1);
		expect(outcomes[0].date).toBe('2023-07-01');
		expect(outcomes[0].reviewed).toBe(0);

		const pairs = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(pairs).toHaveLength(2);
		expect(pairs.every((pair) => pair.outcomeId === outcomes[0].id)).toBe(true);
	});

	it('is idempotent across runs and days', async () => {
		const goalId = await insertGoal(db);
		await insertIntention(db, goalId, '2023-07-01T00:01:00.000Z', 1);
		await checkMissingOutcomes();

		// a second run must not create a second outcome or duplicate pairs
		await checkMissingOutcomes();
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(1);
		expect(await db.selectFrom('outcomes_intentions').selectAll().execute()).toHaveLength(1);

		// an intention on a new day gets its own outcome
		await insertIntention(db, goalId, '2023-07-02T00:01:00.000Z', 1);
		await checkMissingOutcomes();

		const outcomes = await db.selectFrom('outcomes').selectAll().orderBy('date', 'asc').execute();
		expect(outcomes).toHaveLength(2);
		expect(outcomes[1].date).toBe('2023-07-02');
		expect(await db.selectFrom('outcomes_intentions').selectAll().execute()).toHaveLength(2);
	});

	it('keeps an existing reviewed outcome but adds the missing link', async () => {
		const goalId = await insertGoal(db);
		const outcome = await db
			.insertInto('outcomes')
			.values({ reviewed: 1, date: '2023-07-01' })
			.returning('id')
			.executeTakeFirstOrThrow();
		const intentionId = await insertIntention(db, goalId, '2023-07-01T00:01:00.000Z', 1);

		await checkMissingOutcomes();

		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(1);
		expect(outcomes[0].reviewed).toBe(1);

		const pairs = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(pairs).toEqual([{ outcomeId: outcome.id, intentionId }]);
	});

	it('backfills only past days, never today', async () => {
		const goalId = await insertGoal(db);
		const today = localeCurrentDate().toISOString().slice(0, 10);
		const yesterday = localePreviousDate().toISOString().slice(0, 10);
		await insertIntention(db, goalId, `${yesterday}T12:00:00.000Z`, 1);
		await insertIntention(db, goalId, `${today}T12:00:00.000Z`, 1);

		await checkMissingOutcomes();

		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(1);
		expect(outcomes[0].date).toBe(yesterday);

		const pairs = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(pairs).toHaveLength(1);
		expect(pairs[0].outcomeId).toBe(outcomes[0].id);
	});

	it('does nothing when there are no intentions', async () => {
		await checkMissingOutcomes();
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(0);
	});
});
