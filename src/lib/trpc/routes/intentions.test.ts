import { DbInstance } from '$src/lib/db/db';
import { migrateToLatest } from '$src/lib/db/migrate-to-latest';
import type { DB } from '$src/lib/types/data';
import { NoResultError, type Kysely, type QueryResult, type UpdateResult } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Intention } from '../types';
import { intentions } from './intentions';

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
		const added = await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});
		expect(added).toBeDefined();

		const result = (await intentions.list({
			rawInput: undefined,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Intention[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('listByDate', async () => {
		await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});

		const result = (await intentions.listByDate({
			rawInput: {
				startDate: new Date('2023-07-01'),
				endDate: new Date('2023-07-01')
			},
			path: 'listByDate',
			type: 'query',
			ctx: {}
		})) as Record<string, Intention[]>;

		expect(result).toBeDefined();
		expect(result['2023-07-01']).toBeInstanceOf(Array);
		expect(result['2023-07-01']).toHaveLength(1);
		expect(result['2023-07-01'][0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('listUniqueDates', async () => {
		await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});

		const result = (await intentions.listUniqueDates({
			rawInput: {
				startDate: new Date('2023-07-01'),
				endDate: new Date('2023-07-01')
			},
			path: 'listUniqueDates',
			type: 'query',
			ctx: {}
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
		const added = (await intentions.addMany({
			rawInput: [TEST_INTENTION],
			path: 'addMany',
			type: 'mutation',
			ctx: {}
		})) as { id: number }[];
		expect(added).toBeDefined();
		expect(added).toHaveLength(1);
		expect(added[0].id).toBeDefined();
		expect(added[0].id).toBeGreaterThan(0);
	});

	it('latestIntentions', async () => {
		const added1 = await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});
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
		const added2 = await intentions.updateIntentions({
			rawInput: {
				intentions: [TEST_INTENTION_2]
			},
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});
		expect(added2).toBeDefined();

		// Check that the second intention is returned
		const result = (await intentions.intentionsOnLatestDate({
			rawInput: undefined,
			path: 'intentionsOnLatestDate',
			type: 'query',
			ctx: {}
		})) as Intention[];

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(TEST_INTENTION_2));

		// Add another intention with the same latest date, but later id
		const added3 = await intentions.updateIntentions({
			rawInput: {
				intentions: [TEST_INTENTION_3]
			},
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});
		expect(added3).toBeDefined();

		const result2 = (await intentions.intentionsOnLatestDate({
			rawInput: undefined,
			path: 'intentionsOnLatestDate',
			type: 'query',
			ctx: {}
		})) as Intention[];

		expect(result2).toBeInstanceOf(Array);
		expect(result2).toHaveLength(2);
		// Ensure the smaller id is returned
		expect(result2[0]).toEqual(expect.objectContaining(TEST_INTENTION_2));
	});

	it('edit', async () => {
		// Add a new intention
		const added = (await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		})) as QueryResult<Intention>[];
		expect(added).toBeDefined();

		// Edit the intention based on the id
		const editedIntention = { ...TEST_INTENTION, text: 'Edited Text' };
		const edit = (await intentions.edit({
			rawInput: editedIntention,
			path: 'edit',
			type: 'mutation',
			ctx: {}
		})) as UpdateResult;
		expect(edit).toBeDefined();

		// Check that the intention was edited using list
		const result = (await intentions.list({
			rawInput: undefined,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining(editedIntention));
	});

	it('edit with invalid id', async () => {
		const added = (await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		})) as QueryResult<Intention>[];
		expect(added).toBeDefined();

		const editedIntention = { ...TEST_INTENTION, id: 9999 }; // Invalid id
		let error;
		try {
			(await intentions.edit({
				rawInput: editedIntention,
				path: 'edit',
				type: 'mutation',
				ctx: {}
			})) as UpdateResult;
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('appendText', async () => {
		// Add a new intention
		const added = (await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		})) as QueryResult<Intention>[];
		expect(added).toBeDefined();

		// Append text to the intention
		const appendText = ' - edit';
		const appendedIntention = (await intentions.appendText({
			rawInput: { id: TEST_INTENTION.id, text: appendText },
			path: 'appendText',
			type: 'mutation',
			ctx: {}
		})) as UpdateResult;

		expect(appendedIntention).toBeDefined();
		// expect(appendedIntention.numChangedRows).toEqual(1);
		// Check that the intention was edited using list
		const result = (await intentions.list({
			rawInput: undefined,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({ ...TEST_INTENTION, text: TEST_INTENTION.text + appendText })
		);
	});

	it('appendText with invalid id', async () => {
		const added = (await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		})) as QueryResult<Intention>[];
		expect(added).toBeDefined();

		const appendText = '';
		let error;
		try {
			(await intentions.appendText({
				rawInput: { id: 9999, text: appendText }, // Invalid id
				path: 'appendText',
				type: 'mutation',
				ctx: {}
			})) as UpdateResult;
		} catch (e) {
			error = e;
		}
		expect(error).toBeDefined();
	});

	it('updateIntentions', async () => {
		const result = (await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		})) as Intention[];
		expect(result).toBeDefined();
		expect(result[0]).toBeDefined();
		// TODO: result[0].rows checks

		// Check that the intention was added using list
		const listResult = (await intentions.list({
			rawInput: undefined,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Intention[];
		expect(listResult).toBeInstanceOf(Array);
		expect(listResult).toHaveLength(1);
		expect(listResult[0]).toEqual(expect.objectContaining(TEST_INTENTION));
	});

	it('updateIntentionCompletionStatus', async () => {
		await intentions.updateIntentions({
			rawInput: { intentions: [TEST_INTENTION] },
			path: 'updateIntentions',
			type: 'mutation',
			ctx: {}
		});

		// Update the completion status of the test intention
		const newCompletionStatus = 1; // Assuming 1 represents completed
		await intentions.updateIntentionCompletionStatus({
			rawInput: [
				{
					intentionId: TEST_INTENTION.id,
					completed: newCompletionStatus
				}
			],
			path: 'updateIntentionCompletionStatus',
			type: 'mutation',
			ctx: {}
		});

		// Verify that the intention's completion status has been updated
		const result = (await intentions.list({
			rawInput: undefined,
			path: 'list',
			type: 'query',
			ctx: {}
		})) as Intention[];
		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({ ...TEST_INTENTION, completed: newCompletionStatus })
		);

		// Try to update the completion status of a non-existent intention
		let error;
		try {
			await intentions.updateIntentionCompletionStatus({
				rawInput: [
					{
						intentionId: 9999, // Invalid id
						completed: newCompletionStatus
					}
				],
				path: 'updateIntentionCompletionStatus',
				type: 'mutation',
				ctx: {}
			});
		} catch (e) {
			error = e;
		}
		if (error instanceof Error) {
			expect(error.cause).toBeInstanceOf(NoResultError);
		}
	});
});
