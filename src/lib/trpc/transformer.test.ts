import { describe, expect, it } from 'vitest';
import { DeleteResult, InsertResult, UpdateResult } from 'kysely';
import { transformer } from './transformer.ts';

const roundTrip = (value: unknown) =>
	transformer.output.deserialize(transformer.output.serialize(value) as string);

describe('transformer', () => {
	it('round-trips plain values', () => {
		const value = { a: 1, b: 'x', nested: { list: [1, 2, 3] } };
		expect(roundTrip(value)).toEqual(value);
	});

	it('round-trips Date instances', () => {
		const value = { created: new Date('2024-06-15T12:00:00Z') };
		const result = roundTrip(value) as { created: Date };
		expect(result.created).toBeInstanceOf(Date);
		expect(result.created.valueOf()).toEqual(value.created.valueOf());
	});

	it('round-trips kysely result types', () => {
		const insert = roundTrip(new InsertResult(7n, 3n)) as InsertResult;
		expect(insert).toBeInstanceOf(InsertResult);
		expect(insert.insertId).toEqual(7n);
		expect(insert.numInsertedOrUpdatedRows).toEqual(3n);

		const update = roundTrip(new UpdateResult(4n, 2n)) as UpdateResult;
		expect(update.numUpdatedRows).toEqual(4n);
		expect(update.numChangedRows).toEqual(2n);

		const del = roundTrip(new DeleteResult(9n)) as DeleteResult;
		expect(del.numDeletedRows).toEqual(9n);
	});

	it('round-trips mixed structures containing result types', () => {
		const value = {
			when: new Date('2024-01-01'),
			result: new UpdateResult(1n, 1n),
			tags: ['a', 'b']
		};
		const result = roundTrip(value) as typeof value;
		expect(result.when).toBeInstanceOf(Date);
		expect(result.result).toBeInstanceOf(UpdateResult);
		expect(result.tags).toEqual(['a', 'b']);
	});

	it('input and output serialize identically', () => {
		const value = { result: new DeleteResult(2n) };
		expect(transformer.input.serialize(value)).toEqual(transformer.output.serialize(value));
	});
});
