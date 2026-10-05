import { createDb, getDb, setDb } from '#lib/db/db.js';
import { runMigrations } from '#lib/db/migrate-to-latest.js';
import type { DB } from '#lib/types/data.js';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { scheduledJobs } from 'croner';
import { dateKeyInZone, previousDateKey } from '#lib/utils/index.js';
import { createCronJobs, stopCronJobs, checkMissingOutcomes } from './cron';

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
			status: 'pending',
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
		setDb(createDb(':memory:'));
		db = getDb();
		await runMigrations(db);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		stopCronJobs();
		await db.destroy();
	});

	it('reads surviving intentions inside the transaction after a concurrent deletion', async () => {
		const goalId = await insertGoal(db);
		const id = await insertIntention(db, goalId, '2023-07-01T00:00:00.000Z', 1);
		const transaction = db.transaction();
		const execute = transaction.execute.bind(transaction);
		vi.spyOn(transaction, 'execute').mockImplementationOnce(async (callback) => {
			await db.deleteFrom('intentions').where('id', '=', id).execute();
			return execute(callback);
		});
		vi.spyOn(db, 'transaction').mockReturnValueOnce(transaction);
		await checkMissingOutcomes();
		expect(await db.selectFrom('outcomes').selectAll().execute()).toEqual([]);
	});

	it('stops its scheduled job on SvelteKit shutdown', () => {
		createCronJobs();
		const job = scheduledJobs.find((job) => job.name === 'outcomeCron')!;
		expect(job.isStopped()).toBe(false);
		EventEmitter.prototype.emit.call(process, 'sveltekit:shutdown');
		expect(job.isStopped()).toBe(true);
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
		const today = dateKeyInZone('UTC');
		const yesterday = previousDateKey(today);
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

	it('relinks an intention whose date moved after its first outcome link', async () => {
		const goalId = await insertGoal(db);
		const intentionId = await insertIntention(db, goalId, '2023-07-01T00:01:00.000Z', 1);
		await checkMissingOutcomes();

		// The intention moved to July 2 but its July 1 link survives; a stale
		// link must not exempt it from the July 2 outcome.
		await db
			.updateTable('intentions')
			.set({ date: '2023-07-02T00:01:00.000Z' })
			.where('id', '=', intentionId)
			.execute();
		await checkMissingOutcomes();

		const outcomes = await db.selectFrom('outcomes').selectAll().orderBy('date', 'asc').execute();
		expect(outcomes).toHaveLength(2);
		expect(outcomes[1].date).toBe('2023-07-02');

		const pairs = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(
			pairs.some((pair) => pair.outcomeId === outcomes[1].id && pair.intentionId === intentionId)
		).toBe(true);
	});

	it('uses the stored timezone, not the server clock, for the day boundary', async () => {
		const goalId = await insertGoal(db);
		await db
			.insertInto('settings')
			.values({ key: 'timezone', value: 'Pacific/Kiritimati' })
			.execute();

		// UTC sees July 2 15:00; Kiritimati (UTC+14) is already July 3 05:00.
		const now = new Date('2023-07-02T15:00:00.000Z');
		await insertIntention(db, goalId, '2023-07-02T12:00:00.000Z', 1);

		await checkMissingOutcomes(now);

		// Under UTC this day would still be "today" and get no outcome; in the
		// stored zone it is yesterday and gets one.
		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(1);
		expect(outcomes[0].date).toBe('2023-07-02');
	});

	it('does nothing when there are no intentions', async () => {
		await checkMissingOutcomes();
		expect(await db.selectFrom('outcomes').selectAll().execute()).toHaveLength(0);
	});
});
