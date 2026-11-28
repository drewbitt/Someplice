import { z } from 'zod';
import { configuredZoneNow } from '#lib/db/queries.js';
import { journeyDates, loadJourneyGoals } from '#lib/components/journey/windows.js';
import { procedure, t } from '../t.js';
import { getGoalsOnDate } from './goals.js';
import { intentions } from './intentions.js';
import { outcomes } from './outcomes.js';
import { priorities } from './priorities.js';

const createCaller = t.createCallerFactory(t.router({ intentions, outcomes, priorities }));
type JourneyCaller = ReturnType<typeof createCaller>;

async function loadWindow(caller: JourneyCaller, startDate: Date, endDate: Date) {
	const range = { startDate, endDate };
	const [intentionsByDate, outcomes, completedPriorities] = await Promise.all([
		caller.intentions.listByDate(range),
		caller.outcomes.list({ ...range, order: 'desc', orderBy: 'date' }),
		caller.priorities.listCompleted(range)
	]);
	const verdicts = await caller.outcomes.verdictsByOutcomeIds({
		outcomeIds: outcomes.flatMap((outcome) => (outcome.id === null ? [] : [outcome.id]))
	});
	const rows = { intentionsByDate, outcomes, verdicts, completedPriorities };
	return { ...rows, goalsByDate: await loadJourneyGoals(rows, getGoalsOnDate) };
}

export const journey = t.router({
	page: procedure
		.input(z.object({ before: z.iso.date() }).optional())
		.query(async ({ ctx, input }) => {
			const caller = createCaller(ctx);
			const limit = 15;
			const before = input?.before;
			const endDate = before ? new Date(before) : await configuredZoneNow();
			if (before) endDate.setUTCDate(endDate.getUTCDate() - 1);
			const range = before ? { startDate: new Date(0), endDate } : {};
			let dates = (await caller.intentions.listUniqueDates({ ...range, limit })).map(
				(row) => row.date
			);
			if (dates.length === 0) {
				// Outcome-only and milestone-only days can exist beyond the last intention.
				const [outcomes, completedPriorities] = await Promise.all([
					caller.outcomes.list({ ...range, limit, order: 'desc', orderBy: 'date' }),
					caller.priorities.listCompleted({ ...range, limit })
				]);
				dates = journeyDates({ intentionsByDate: {}, outcomes, completedPriorities })
					.sort((a, b) => b.localeCompare(a))
					.slice(0, limit);
			}

			const oldest = dates.at(-1);
			const newest = dates[0] ? new Date(dates[0]) : endDate;
			// The first page includes today and any later intention day. Older pages
			// include the entire span up to the cursor, including days without intentions.
			const windowEnd = newest > endDate ? newest : endDate;
			return {
				window: await loadWindow(caller, oldest ? new Date(oldest) : endDate, windowEnd),
				oldestLoadedDate: oldest ?? before ?? endDate.toISOString().slice(0, 10),
				hasMore: oldest !== undefined
			};
		}),
	day: procedure.input(z.iso.date()).query(({ ctx, input }) => {
		const date = new Date(input);
		return loadWindow(createCaller(ctx), date, date);
	})
});
