import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import { NoResultError, type Kysely, type UpdateResult } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Intention } from '../types';
import { createCallerFactory, router } from '../router';

const TEST_INTENTION: Intention = {
	id: 1,
	goalId: 1,
	orderNumber: 1,
	completed: 0,
	text: 'test',
	subIntentionQualifier: null,
	date: '2023-07-01T00:01:00.000Z'
};

describe('intentions', () => {
	let db: Kysely<DB>;
	const createCaller = createCallerFactory(router);
	const caller = createCaller({});

	beforeEach(async () => {
		const dbInstance = DbInstance.getInstance();
		dbInstance.setNewTestDb();
		db = dbInstance.db;
		await migrateToLatest(db);

		// Insert a test goal
		const TEST_GOAL = {
			active: 1,
			title: 'Test Goal',
			description: 'A goal for testing purposes.',
			color: 'hsl(0, 0%, 50%)',
			orderNumber: 1
		};

		await db.insertInto('goals').values(TEST_GOAL).execute();
	});

	afterEach(async () => {
		await db.destroy();
		DbInstance.resetInstance();
	});

	it('list', async () => {
		const added = await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });
		expect(added).toBeDefined();

		const result = (await caller.intentions.list(undefined)) as Intention[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('listByDate', async () => {
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });

		const result = (await caller.intentions.listByDate({
			startDate: new Date('2023-07-01'),
			endDate: new Date('2023-07-01')
		})) as Record<string, Intention[]>;

		expect(result).toBeDefined();
		expect(result['2023-07-01']).toBeInstanceOf(Array);
		expect(result['2023-07-01']).toHaveLength(1);
		expect(result['2023-07-01'][0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('listUniqueDates', async () => {
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });

		const result = (await caller.intentions.listUniqueDates({
			startDate: new Date('2023-07-01'),
			endDate: new Date('2023-07-01')
		})) as { date: string }[];

		expect(result).toBeDefined();
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(Object);
		// Compare the YYYY-MM-DD part of the date
		const date = new Date(result[0].date).toISOString().split('T')[0];
		expect(date).toEqual('2023-07-01');
	});

	it('addMany', async () => {
		const added = (await caller.intentions.addMany([TEST_INTENTION])) as { id: number }[];
		expect(added).toBeDefined();
		expect(added).toHaveLength(1);
		expect(added[0].id).toBeDefined();
		expect(added[0].id).toBeGreaterThan(0);
	});

	it('latestIntentions', async () => {
		const added1 = await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });
		expect(added1).toBeDefined();

		// Create new test intentions on a later date
		const TEST_INTENTION_2 = {
			...TEST_INTENTION,
			id: 2,
			date: '2023-07-02T00:01:00.000Z',
			orderNumber: 2
		};
		const TEST_INTENTION_3 = {
			...TEST_INTENTION,
			id: 3,
			date: '2023-07-02T00:02:00.000Z',
			orderNumber: 3
		};

		// Add second intention
		const added2 = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION_2]
		});
		expect(added2).toBeDefined();

		// Check that the second intention is returned
		const result = (await caller.intentions.intentionsOnLatestDate(undefined)) as Intention[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(TEST_INTENTION_2));

		// Add another intention with the same latest date, but later id
		const added3 = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION_3]
		});
		expect(added3).toBeDefined();

		const result2 = (await caller.intentions.intentionsOnLatestDate(undefined)) as Intention[];

		expect(result2).toBeInstanceOf(Array);
		expect(result2).toHaveLength(2);
		// Ensure the smaller id is returned
		expect(result2[0]).toEqual(expect.objectContaining(TEST_INTENTION_2));
	});

	it('edit', async () => {
		// Add a new intention
		const added = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		});
		expect(added).toBeDefined();

		// Edit the intention based on the id
		const editedIntention = { ...TEST_INTENTION, text: 'Edited Text' };
		const edit = (await caller.intentions.edit(editedIntention)) as UpdateResult;
		expect(edit).toBeDefined();

		// Check that the intention was edited using list
		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(editedIntention));
	});

	it('edit with invalid id', async () => {
		const added = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		});
		expect(added).toBeDefined();

		const editedIntention = { ...TEST_INTENTION, id: 9999 }; // Invalid id
		let error;
		try {
			(await caller.intentions.edit(editedIntention)) as UpdateResult;
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('appendText', async () => {
		// Add a new intention
		const added = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		});
		expect(added).toBeDefined();

		// Append text to the intention
		const appendText = ' - edit';
		const appendedIntention = (await caller.intentions.appendText({
			id: TEST_INTENTION.id as number,
			text: appendText
		})) as UpdateResult;

		expect(appendedIntention).toBeDefined();
		// expect(appendedIntention.numChangedRows).toEqual(1);
		// Check that the intention was edited using list
		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({ ...TEST_INTENTION, text: TEST_INTENTION.text + appendText })
		);
	});

	it('appendText with invalid id', async () => {
		const added = await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		});
		expect(added).toBeDefined();

		const appendText = '';
		let error;
		try {
			(await caller.intentions.appendText({ id: 9999, text: appendText })) as UpdateResult; // Invalid id
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('updateIntentions', async () => {
		const result = (await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		})) as unknown as Intention[];
		expect(result).toBeDefined();
		expect(result[0]).toBeDefined();
		// TODO: result[0].rows checks

		// Check that the intention was added using list
		const listResult = (await caller.intentions.list(undefined)) as Intention[];
		expect(listResult).toBeInstanceOf(Array);
		expect(listResult).toHaveLength(1);
		expect(listResult[0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('updateIntentionCompletionStatus', async () => {
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });

		// Update the completion status of the test intention
		const newCompletionStatus = 1; // Assuming 1 represents completed
		await caller.intentions.updateIntentionCompletionStatus([
			{
				intentionId: TEST_INTENTION.id as number,
				completed: newCompletionStatus
			}
		]);

		// Verify that the intention's completion status has been updated
		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({ ...TEST_INTENTION, completed: newCompletionStatus })
		);

		// Try to update the completion status of a non-existent intention
		let error;
		try {
			await caller.intentions.updateIntentionCompletionStatus([
				{
					intentionId: 9999, // Invalid id
					completed: newCompletionStatus
				}
			]);
		} catch (e) {
			error = e;
		}
		if (error instanceof Error) {
			expect(error.cause).toBeInstanceOf(NoResultError);
		}
	});

	it('updateIntentions swaps orderNumbers without tripping the unique index', async () => {
		const intention2 = { ...TEST_INTENTION, id: 2, orderNumber: 2 };
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION, intention2] });

		// Swap their positions: a permutation that only succeeds via the two-phase update
		const swapped = [
			{ ...TEST_INTENTION, orderNumber: 2 },
			{ ...intention2, orderNumber: 1 }
		];
		await caller.intentions.updateIntentions({ intentions: swapped });

		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result).toHaveLength(2);
		expect(result.find((i) => i.id === 1)?.orderNumber).toEqual(2);
		expect(result.find((i) => i.id === 2)?.orderNumber).toEqual(1);
	});

	it('updateIntentions reorders when an unchanged row holds a large orderNumber', async () => {
		// A row already in the old scratch range (orderNumber + 100000) must not block reorders
		const largeOrder = { ...TEST_INTENTION, id: 2, orderNumber: 100001 };
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION, largeOrder] });

		await caller.intentions.updateIntentions({
			intentions: [{ ...TEST_INTENTION, orderNumber: 2 }]
		});

		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result.find((i) => i.id === 1)?.orderNumber).toEqual(2);
		expect(result.find((i) => i.id === 2)?.orderNumber).toEqual(100001);
	});

	it('updateIntentions is an upsert, not a duplicate insert', async () => {
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });
		await caller.intentions.updateIntentions({
			intentions: [{ ...TEST_INTENTION, text: 'updated text' }]
		});

		const result = (await caller.intentions.list(undefined)) as Intention[];
		expect(result).toHaveLength(1);
		expect(result[0].text).toEqual('updated text');
	});

	it('addMany rejects duplicate orderNumbers on the same day', async () => {
		await caller.intentions.addMany([TEST_INTENTION]);

		let error;
		try {
			// same DATE(date) and orderNumber as TEST_INTENTION, different time/id
			await caller.intentions.addMany([{ ...TEST_INTENTION, date: '2023-07-01T09:00:00.000Z' }]);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('delete removes the intention, its outcome links, and an orphaned outcome', async () => {
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION] });
		const outcome = await db
			.insertInto('outcomes')
			.values({ reviewed: 1, date: '2023-07-01' })
			.returning('id')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('outcomes_intentions')
			.values({ outcomeId: outcome.id as number, intentionId: TEST_INTENTION.id as number })
			.execute();

		await caller.intentions.delete(TEST_INTENTION.id as number);

		const intentions = (await caller.intentions.list(undefined)) as Intention[];
		expect(intentions).toHaveLength(0);
		const links = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(links).toHaveLength(0);
		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(0);
	});

	it('delete keeps an outcome that still has other intentions', async () => {
		const intention2 = { ...TEST_INTENTION, id: 2, orderNumber: 2 };
		await caller.intentions.updateIntentions({ intentions: [TEST_INTENTION, intention2] });
		const outcome = await db
			.insertInto('outcomes')
			.values({ reviewed: 1, date: '2023-07-01' })
			.returning('id')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('outcomes_intentions')
			.values([
				{ outcomeId: outcome.id as number, intentionId: TEST_INTENTION.id as number },
				{ outcomeId: outcome.id as number, intentionId: intention2.id as number }
			])
			.execute();

		await caller.intentions.delete(TEST_INTENTION.id as number);

		const intentions = (await caller.intentions.list(undefined)) as Intention[];
		expect(intentions).toHaveLength(1);
		const outcomes = await db.selectFrom('outcomes').selectAll().execute();
		expect(outcomes).toHaveLength(1);
		const links = await db.selectFrom('outcomes_intentions').selectAll().execute();
		expect(links).toHaveLength(1);
		expect(links[0].intentionId).toEqual(intention2.id);
	});

	it('delete a non-existent intention errors', async () => {
		let error;
		try {
			await caller.intentions.delete(9999);
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});
});
