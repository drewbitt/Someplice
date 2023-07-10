import type { UpdateResult } from 'kysely';

/***
 * Similiar to UpdateResult from kysely, but with bigint converted to number
 */
export class UpdateResultNormal {
	readonly numUpdatedRows: number | undefined;
	readonly numChangedRows: number | undefined;

	constructor(numUpdatedRows: bigint, numChangedRows: bigint | undefined) {
		this.numUpdatedRows = numUpdatedRows ? Number(numUpdatedRows) : undefined;
		this.numChangedRows = numChangedRows ? Number(numChangedRows) : undefined;
	}
}

export function processUpdateResults(updateResults: UpdateResult[]): UpdateResultNormal[] {
	return updateResults.map(
		({ numUpdatedRows, numChangedRows }) => new UpdateResultNormal(numUpdatedRows, numChangedRows)
	);
}
