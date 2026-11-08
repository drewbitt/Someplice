import { TRPCError } from '@trpc/server';
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import { getDb } from '#lib/db/db.js';
import { getConfiguredTimeZone, getSetting, isUniqueViolation } from '#lib/db/queries.js';
import { elapsedSeconds, FOCUS_KINDS } from '#lib/focus.js';
import { dateKeyInZone } from '#lib/utils/index.js';
import type { DB } from '#lib/types/data.js';
import { procedure, t } from '../t.js';

const minutes = z.number().int().min(1).max(180);
export const TimerPreferences = z.object({
	workMinutes: minutes.default(25),
	hourglassMinutes: minutes.default(25),
	shortBreakMinutes: minutes.default(5),
	longBreakMinutes: minutes.default(20)
});
const StartTimer = z.object({
	id: z.uuid(),
	kind: z.enum(FOCUS_KINDS),
	intentionId: z.number().int().positive().nullable(),
	minutes,
	preferences: TimerPreferences
});

// Reconcile at the original deadline, not the time the browser woke up.
// The conditional update and single row make repeated expiry checks harmless.
async function reconcile(db: Kysely<DB>, now: number) {
	const active = await db
		.selectFrom('focus_sessions')
		.selectAll()
		.where('status', 'in', ['running', 'paused'])
		.executeTakeFirst();
	if (active?.status === 'running' && elapsedSeconds(active, now) >= active.plannedSeconds) {
		await db
			.updateTable('focus_sessions')
			.set({
				status: 'completed',
				elapsedSeconds: active.plannedSeconds,
				endedAt: active.lastStartedAt! + (active.plannedSeconds - active.elapsedSeconds) * 1000,
				lastStartedAt: null,
				revision: active.revision + 1
			})
			.where('id', '=', active.id)
			.where('revision', '=', active.revision)
			.execute();
	}
}

async function snapshot(db: Kysely<DB>, now: number) {
	const day = dateKeyInZone(await getConfiguredTimeZone(db), new Date(now));
	const active = await db
		.selectFrom('focus_sessions')
		.selectAll()
		.where('status', 'in', ['running', 'paused'])
		.executeTakeFirst();
	const latest = await db
		.selectFrom('focus_sessions')
		.selectAll()
		.orderBy('startedAt', 'desc')
		.orderBy(sql`rowid`, 'desc')
		.executeTakeFirst();
	const recent = await db
		.selectFrom('focus_sessions')
		.selectAll()
		.where('day', '=', day)
		.where('status', 'in', ['completed', 'cancelled'])
		.orderBy('startedAt', 'desc')
		.orderBy(sql`rowid`, 'desc')
		.limit(20)
		.execute();
	const totals = await db
		.selectFrom('focus_sessions')
		.select([
			sql<number>`COALESCE(SUM(CASE WHEN kind = 'pomodoro' THEN 1 ELSE 0 END), 0)`.as('pomodoros'),
			sql<number>`COALESCE(SUM(elapsedSeconds), 0)`.as('seconds')
		])
		.where('day', '=', day)
		.where('status', '=', 'completed')
		.where('kind', '!=', 'break')
		.executeTakeFirstOrThrow();
	const intentions = await db
		.selectFrom('intentions')
		.innerJoin('goals', 'goals.id', 'intentions.goalId')
		.select(['intentions.id', 'intentions.text', 'goals.title as goalTitle'])
		.where('goals.active', '=', 1)
		.where('intentions.status', '=', 'pending')
		.where(sql`DATE(intentions.date)`, '=', day)
		.orderBy('intentions.orderNumber')
		.execute();
	let preferences = TimerPreferences.parse({});
	const stored = await getSetting(db, 'timer.preferences');
	if (stored) {
		try {
			preferences = TimerPreferences.parse(JSON.parse(stored));
		} catch {
			/* use defaults */
		}
	}
	return {
		now,
		day,
		active: active ?? null,
		latest: latest ?? null,
		recent,
		totals,
		intentions,
		preferences
	};
}

const conflict = () =>
	new TRPCError({
		code: 'CONFLICT',
		message: 'The timer changed elsewhere. Its current state has been refreshed.'
	});

export const focus = t.router({
	state: procedure.query(() =>
		getDb()
			.transaction()
			.execute(async (db) => {
				const now = Date.now();
				await reconcile(db, now);
				return snapshot(db, now);
			})
	),
	start: procedure.input(StartTimer).mutation(async ({ input }) => {
		try {
			return await getDb()
				.transaction()
				.execute(async (db) => {
					const now = Date.now();
					await reconcile(db, now);
					const existing = await db
						.selectFrom('focus_sessions')
						.select('id')
						.where('id', '=', input.id)
						.executeTakeFirst();
					if (existing) return snapshot(db, now); // retry after a lost response
					const active = await db
						.selectFrom('focus_sessions')
						.select('id')
						.where('status', 'in', ['running', 'paused'])
						.executeTakeFirst();
					if (active) throw conflict();
					const day = dateKeyInZone(await getConfiguredTimeZone(db), new Date(now));
					let intentionText: string | null = null;
					if (input.kind !== 'break' && input.intentionId !== null) {
						const intention = await db
							.selectFrom('intentions')
							.innerJoin('goals', 'goals.id', 'intentions.goalId')
							.select('intentions.text')
							.where('intentions.id', '=', input.intentionId)
							.where('intentions.status', '=', 'pending')
							.where('goals.active', '=', 1)
							.where(sql`DATE(intentions.date)`, '=', day)
							.executeTakeFirst();
						if (!intention)
							throw new TRPCError({
								code: 'CONFLICT',
								message: 'Choose a pending intention for today, or start unassigned.'
							});
						intentionText = intention.text;
					}
					await db
						.insertInto('focus_sessions')
						.values({
							id: input.id,
							kind: input.kind,
							status: 'running',
							day,
							intentionId: input.kind === 'break' ? null : input.intentionId,
							intentionText,
							plannedSeconds: input.minutes * 60,
							startedAt: now,
							lastStartedAt: now,
							endedAt: null
						})
						.execute();
					await db
						.insertInto('settings')
						.values({ key: 'timer.preferences', value: JSON.stringify(input.preferences) })
						.onConflict((oc) =>
							oc.column('key').doUpdateSet({ value: JSON.stringify(input.preferences) })
						)
						.execute();
					return snapshot(db, now);
				});
		} catch (error) {
			if (isUniqueViolation(error)) throw conflict();
			throw error;
		}
	}),
	control: procedure
		.input(
			z.object({
				id: z.uuid(),
				revision: z.number().int().nonnegative(),
				action: z.enum(['pause', 'resume', 'stop', 'cancel'])
			})
		)
		.mutation(({ input }) =>
			getDb()
				.transaction()
				.execute(async (db) => {
					const now = Date.now();
					await reconcile(db, now);
					const session = await db
						.selectFrom('focus_sessions')
						.selectAll()
						.where('id', '=', input.id)
						.executeTakeFirstOrThrow();
					// A retry cannot affect a later session, nor duplicate recorded time.
					if (session.status === 'completed' || session.status === 'cancelled')
						return snapshot(db, now);
					if (session.revision !== input.revision) throw conflict();
					const elapsed = Math.floor(elapsedSeconds(session, now));
					const revision = session.revision + 1;
					if (
						input.action === 'pause' &&
						session.kind === 'hourglass' &&
						session.status === 'running'
					) {
						await db
							.updateTable('focus_sessions')
							.set({ status: 'paused', elapsedSeconds: elapsed, lastStartedAt: null, revision })
							.where('id', '=', session.id)
							.execute();
					} else if (input.action === 'resume' && session.status === 'paused') {
						await db
							.updateTable('focus_sessions')
							.set({ status: 'running', lastStartedAt: now, revision })
							.where('id', '=', session.id)
							.execute();
					} else if (
						(input.action === 'stop' && session.kind === 'hourglass') ||
						input.action === 'cancel'
					) {
						await db
							.updateTable('focus_sessions')
							.set({
								status: input.action === 'stop' ? 'completed' : 'cancelled',
								elapsedSeconds: elapsed,
								lastStartedAt: null,
								endedAt: now,
								revision
							})
							.where('id', '=', session.id)
							.execute();
					} else {
						throw new TRPCError({
							code: 'BAD_REQUEST',
							message: 'That action is not available for this timer.'
						});
					}
					return snapshot(db, now);
				})
		)
});
