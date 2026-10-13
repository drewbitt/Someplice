/*
 * This file is to be used to insert fake data into the database for testing purposes.
 */

import { faker } from '@faker-js/faker';
import { getDb } from './db.ts';
import { dbLogger } from '../utils/logger.ts';

const db = getDb();

const numberOfGoals = 9;
const dayMs = 24 * 60 * 60 * 1000;

const generateSubIntentionQualifier = () => {
	if (Math.random() < 0.3) {
		// Approximately 30% of the time, return null
		return null;
	}

	const alphabet = 'abcdefghijklmnopqrstuvwxyz';
	let result = '';
	for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
		result += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return result;
};

/**
 * This function is used to generate dates for the intentions.
 * The first 10 intentions will be from the last 24 hours.
 * The next 10 intentions will be from the last 7 days.
 * The rest of the intentions will be from the last 2 years.
 */
const customDateMath = (i: number) => {
	const now = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000);
	return i < 10
		? faker.date
				.between({
					from: new Date(now.getTime() - dayMs),
					to: now
				})
				.toISOString()
		: i < 20
			? faker.date
					.between({
						from: new Date(now.getTime() - 7 * dayMs),
						to: now
					})
					.toISOString()
			: faker.date
					.between({
						from: new Date(now.getTime() - 2 * 365 * dayMs),
						to: now
					})
					.toISOString();
};

async function insertFakeData() {
	// Initialize incremental counters
	let activeCount = 1;

	// Generate fake goals
	const goals = Array.from({ length: numberOfGoals }, () => {
		if (faker.number.int({ min: 0, max: 1 })) {
			// active goal
			return {
				active: 1,
				orderNumber: activeCount++,
				title: faker.lorem.sentence(),
				description: faker.lorem.sentence(),
				color: faker.color.hsl({ format: 'css' })
			};
		} else {
			// inactive goal
			return {
				active: 0,
				orderNumber: 0,
				title: faker.lorem.sentence(),
				description: faker.lorem.sentence(),
				color: faker.color.hsl({ format: 'css' })
			};
		}
	});

	// Generate fake intentions
	const intentions = Array.from({ length: 50 }, (_, i) => ({
		orderNumber: i + 1,
		status: faker.number.int({ min: 0, max: 1 }) === 1 ? ('done' as const) : ('pending' as const),
		text: faker.lorem.sentence({ min: 2, max: 10 }),
		subIntentionQualifier: generateSubIntentionQualifier(),
		date: customDateMath(i),
		goalId: faker.number.int({ min: 1, max: numberOfGoals })
	}));

	// Generate fake outcomes. Outcome i is dated 20-i days ago (20 days ago down to yesterday).
	const outcomes = Array.from({ length: 20 }, (_, i) => ({
		id: i + 1,
		reviewed: faker.number.int({ min: 0, max: 1 }),
		date: new Date(Date.now() - (20 - i) * dayMs).toISOString().slice(0, 10)
	}));

	// Generate fake outcomes_intentions
	// Do this a bit differently in order to have unique ids but still match existing data
	const outcomesIntentions = Array.from({ length: 40 }, (_, i) => ({
		outcomeId: Math.floor(i / 20) + 1,
		intentionId: (i % 50) + 1
	}));

	// Generate fake dates for when the goal was started. For now, just use the current date
	const goal_logs = goals.flatMap((goal, i) => {
		const startDate = new Date().toISOString();
		if (goal.active) {
			return [
				{
					goalId: i + 1,
					type: 'start',
					date: startDate
				}
			];
		} else {
			return [
				{
					goalId: i + 1,
					type: 'start',
					date: startDate
				},
				{
					goalId: i + 1,
					type: 'end',
					date: new Date(Date.now() - i * 1000).toISOString()
				}
			];
		}
	});

	// Combine all inserts into single transaction
	await db.transaction().execute(async (db) => {
		await db.insertInto('goals').values(goals).execute();
		await db.insertInto('intentions').values(intentions).execute();
		await db.insertInto('outcomes').values(outcomes).execute();
		await db.insertInto('outcomes_intentions').values(outcomesIntentions).execute();
		await db.insertInto('goal_logs').values(goal_logs).execute();
	});
	dbLogger.info(
		`Inserted ${numberOfGoals} goals, 50 intentions, 20 outcomes, 40 outcomes_intentions, and ${numberOfGoals} start dates.`
	);
}

insertFakeData().catch((err) => {
	console.error(err);
	process.exit(1);
});
