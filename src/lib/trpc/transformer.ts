import { parse, stringify, uneval } from 'devalue';
import { DeleteResult, InsertResult, UpdateResult } from 'kysely';

/* Required or deserialization will fail with eval not knowing the type. 
Keeping it this way for the perf instead of mapping the serialized data to the type */
/* eslint-disable @typescript-eslint/no-explicit-any */
(globalThis as any).DeleteResult = DeleteResult;
(globalThis as any).InsertResult = InsertResult;
(globalThis as any).UpdateResult = UpdateResult;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const transformer = {
	input: {
		serialize: (object: unknown): string => {
			const stringified = stringify(object, {
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
			});
			return stringified;
		},
		deserialize: (object: string): unknown => {
			const parsed = parse(object, {
				DeleteResult: (numDeletedRows: bigint): DeleteResult => {
					return new DeleteResult(numDeletedRows);
				},
				InsertResult: ([insertId, numInsertedOrUpdatedRows]: [
					bigint | undefined,
					bigint | undefined
				]): InsertResult => {
					return new InsertResult(insertId, numInsertedOrUpdatedRows);
				},
				UpdateResult: ([numUpdatedRows, numChangedRows]: [
					bigint,
					bigint | undefined
				]): UpdateResult => {
					return new UpdateResult(numUpdatedRows, numChangedRows);
				}
			});
			return parsed;
		}
	},
	output: {
		serialize: (object: unknown): string => {
			const unevaluated = uneval(object, (value: unknown) => {
				if (value instanceof DeleteResult) {
					return `new DeleteResult(${value.numDeletedRows})`;
				}
				if (value instanceof InsertResult) {
					return `new InsertResult(${value.insertId},${value.numInsertedOrUpdatedRows})`;
				}
				if (value instanceof UpdateResult) {
					return `new UpdateResult(${value.numUpdatedRows},${value.numChangedRows})`;
				}
			});
			return unevaluated;
		},
		deserialize: (object: string): unknown => {
			const evaluated = (0, eval)(`(${object})`);
			return evaluated;
		}
	}
};
