/*
 * This file is to be used to insert fake data into the database for testing purposes.
 */

import {
	incrementalDate,
	incrementalNumber,
	randBetweenDate,
	randHsl,
	randNumber,
	randText,
	randTextRange
} from '@ngneat/falso';
import { DbInstance } from './db';
import { dbLogger } from '$src/lib/utils/logger';

const { db } = DbInstance.getInstance();

const numberOfGoals = 9;
const incrementalNumberFactory = incrementalNumber();

// This factory will generate a new date every time it's called
// The dates will be between 20 days ago and 1 day ago
// This does not cover all historical dates, but it's good enough for testing
const incrementalDateFactory = incrementalDate({
	from: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
	to: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
	step: 24 * 60 * 60 * 1000 // 1 day
});

const generateSubIntentionQualifier = () => {
	if (Math.random() < 0.3) {
		// Approximately 30% of the time, return null
		return null;
	}

	const alphabet = 'abcdefghijklmnopqrstuvwxyz';
	let result = '';
	for (let i = 0; i < randNumber({ min: 1, max: 3 }); i++) {
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
		? randBetweenDate({
				from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
				to: now
			}).toISOString()
		: i < 20
			? randBetweenDate({
					from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
					to: now
				}).toISOString()
			: randBetweenDate({
					from: new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
					to: now
				}).toISOString();
};

async function insertFakeData() {
	// Initialize incremental counters
	let activeCount = 1;

	// Generate fake goals
	const goals = Array.from({ length: numberOfGoals }, () => {
		if (randNumber({ min: 0, max: 1 })) {
			// active goal
			return {
				active: 1,
				orderNumber: activeCount++,
				title: randText(),
				description: randText(),
				color: randHsl()
			};
		} else {
			// inactive goal
			return {
				active: 0,
				orderNumber: 0,
				title: randText(),
				description: randText(),
				color: randHsl()
			};
		}
	});

	// Generate fake intentions
	const intentions = Array.from({ length: 50 }, (_, i) => ({
		orderNumber: i + 1,
		completed: randNumber({ min: 0, max: 1 }),
		text: randTextRange({ min: 10, max: 80 }),
		subIntentionQualifier: generateSubIntentionQualifier(),
		date: customDateMath(i),
		goalId: randNumber({ min: 1, max: numberOfGoals })
	}));

	// Generate fake outcomes
	const outcomes = Array.from({ length: 20 }, () => {
		const date = incrementalDateFactory();
		if (!date) {
			throw new Error('Failed to generate unique date for outcome');
		}

		return {
			id: incrementalNumberFactory(),
			reviewed: randNumber({ min: 0, max: 1 }),
			// Convert the date to ISO 8601 date string and slice to remove the time
			date: date.toISOString().slice(0, 10)
		};
	});

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
