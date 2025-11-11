import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import { NoResultError, type Kysely, type QueryResult, type UpdateResult } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Intention } from '../types';
import { createCallerFactory, router } from '../router';
import { IntentionsSchema } from './intentions';

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
		const added = (await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		})) as QueryResult<Intention>[];
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
		const added = (await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		})) as QueryResult<Intention>[];
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
		const added = (await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		})) as QueryResult<Intention>[];
		expect(added).toBeDefined();

		// Append text to the intention
		const appendText = ' - edit';
		const appendedIntention = (await caller.intentions.appendText({
			id: TEST_INTENTION.id,
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
		const added = (await caller.intentions.updateIntentions({
			intentions: [TEST_INTENTION]
		})) as QueryResult<Intention>[];
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
		})) as Intention[];
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
				intentionId: TEST_INTENTION.id,
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

	it('schema validates required fields', () => {
		expect(() => IntentionsSchema.parse({ id: 1, goalId: 1, orderNumber: 1, completed: 0, text: 'test', subIntentionQualifier: null, date: '2024-01-01T00:00:00.000Z' })).not.toThrow();
	});
});
