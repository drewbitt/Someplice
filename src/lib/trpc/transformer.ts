import { parse, stringify } from 'devalue';
import { DeleteResult, InsertResult, UpdateResult } from 'kysely';

const reducers = {
	DeleteResult: (value: unknown): bigint | undefined => {
		if (value instanceof DeleteResult) {
			return value.numDeletedRows;
		}
	},
	InsertResult: (value: unknown): [bigint | undefined, bigint | undefined] | undefined => {
		if (value instanceof InsertResult) {
			return [value.insertId, value.numInsertedOrUpdatedRows];
		}
	},
	UpdateResult: (value: unknown): [bigint, bigint | undefined] | undefined => {
		if (value instanceof UpdateResult) {
			return [value.numUpdatedRows, value.numChangedRows];
		}
	}
};

const revivers = {
	DeleteResult: (numDeletedRows: bigint): DeleteResult => {
		return new DeleteResult(numDeletedRows);
	},
	InsertResult: ([insertId, numInsertedOrUpdatedRows]: [
		bigint | undefined,
		bigint | undefined
	]): InsertResult => {
		return new InsertResult(insertId, numInsertedOrUpdatedRows);
	},
	UpdateResult: ([numUpdatedRows, numChangedRows]: [bigint, bigint | undefined]): UpdateResult => {
		return new UpdateResult(numUpdatedRows, numChangedRows);
	}
};

export const transformer = {
	input: {
		serialize: (object: unknown): string => {
			const stringified = stringify(object, reducers);
			return stringified;
		},
		deserialize: (object: string): unknown => {
			const parsed = parse(object, revivers);
			return parsed;
		}
	},
	output: {
		serialize: (object: unknown): string => {
			const stringified = stringify(object, reducers);
			return stringified;
		},
		deserialize: (object: string): unknown => {
			const parsed = parse(object, revivers);
			return parsed;
		}
	}
};
