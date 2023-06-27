/*
 * This file is to be used to insert fake data into the database for testing purposes.
 */

import { randHsl, randNumber, randText, incrementalNumber, randBetweenDate } from '@ngneat/falso';
import { db } from './db';

const numberOfGoals = 9;
const incrementalNumberFactory = incrementalNumber();

const generateSubIntentionQualifier = () => {
	if (Math.random() < 0.3) {
		// Approximately 30% of the time, return null
		return null;
	}

	const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	for (let i = 0; i < randNumber({ min: 1, max: 3 }); i++) {
		result += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return result;
};

async function insertFakeData() {
	// Generate fake goals
	const goals = Array.from({ length: numberOfGoals }, (_, i) => ({
		active: randNumber({ min: 0, max: 1 }),
		orderNumber: i + 1,
		title: randText(),
		description: randText(),
		color: randHsl()
	}));

	// Generate fake intentions
	const intentions = Array.from({ length: 50 }, (_, i) => ({
		orderNumber: i + 1,
		completed: randNumber({ min: 0, max: 1 }),
		text: randText(),
		subIntentionQualifier: generateSubIntentionQualifier(),
		date:
			i < 10
				? randBetweenDate({
						from: new Date(Date.now() - 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString()
				: i < 20
				? randBetweenDate({
						from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString()
				: randBetweenDate({
						from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString(),
		goalId: randNumber({ min: 1, max: numberOfGoals })
	}));

	// Generate fake outcomes
	const outcomes = Array.from({ length: 20 }, (_, i) => ({
		id: incrementalNumberFactory(),
		completed: randNumber({ min: 0, max: 1 }),
		date:
			i < 5
				? randBetweenDate({
						from: new Date(Date.now() - 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString()
				: i < 10
				? randBetweenDate({
						from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString()
				: randBetweenDate({
						from: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
						to: new Date()
				  }).toISOString()
	}));

	// Generate fake outcomes_intentions
	// Do this a bit differently in order to have unique ids but still match existing data
	const outcomesIntentions = Array.from({ length: 40 }, (_, i) => ({
		outcomeId: Math.floor(i / 20) + 1,
		intentionId: (i % 50) + 1
	}));

	// Combine all inserts into single transaction
	await db.transaction().execute(async (db) => {
		await db.insertInto('goals').values(goals).execute();
		await db.insertInto('intentions').values(intentions).execute();
		await db.insertInto('outcomes').values(outcomes).execute();
		await db.insertInto('outcomes_intentions').values(outcomesIntentions).execute();
	});
}

insertFakeData().catch((err) => {
	console.error(err);
	process.exit(1);
});
