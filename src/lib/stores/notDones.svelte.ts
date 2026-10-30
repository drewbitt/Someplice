import { trpc } from '#lib/trpc/client.js';
import type { Intention } from '#lib/trpc/types.js';
import { dateKeyInZone, wallClockInZone } from '#lib/utils/index.js';
import { intentionMatchKey } from '#lib/utils/notDones.js';
import { PersistedState } from 'runed';
import { appTimeZone } from '#lib/stores/timezone.svelte.js';
import { SvelteDate } from 'svelte/reactivity';

/**
 * Intentions from the most recent days before today, shared by the NotDones
 * propagator panel and the today list's paren inflation.
 */
class NotDonesStore {
	recentIntentions = $state<Intention[]>([]);
	loading = $state(false);
	error = $state('');
	private skipped = new PersistedState<{ day: string; keys: string[] }>('notDones:skipped', {
		day: '',
		keys: []
	});
	private inflight: { key: string; promise: Promise<void> } | null = null;
	private historyKey = '';

	refresh({ days = 3, force = false }: { days?: number; force?: boolean } = {}) {
		const endDate = wallClockInZone(appTimeZone.current);
		const key = `${appTimeZone.current}|${endDate.toISOString().slice(0, 10)}|${days}`;
		if (!force && this.inflight?.key === key) return this.inflight.promise;
		// Never show yesterday's window (or another zone's) as current while loading.
		if (key !== this.historyKey) this.recentIntentions = [];
		this.historyKey = key;
		endDate.setUTCDate(endDate.getUTCDate() - 1);
		const startDate = new SvelteDate(endDate);
		startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
		this.loading = true;
		this.error = '';
		const request = { key, promise: Promise.resolve() };
		this.inflight = request;
		request.promise = (async () => {
			try {
				const rows = await trpc().intentions.list.query({ startDate, endDate });
				if (this.inflight === request) this.recentIntentions = rows;
			} catch (error) {
				if (this.inflight === request) this.error = 'Could not load NotDones. Please try again.';
				throw error;
			} finally {
				if (this.inflight === request) {
					this.loading = false;
					this.inflight = null;
				}
			}
		})();
		return request.promise;
	}

	isSkipped(intention: Intention) {
		return (
			this.skipped.current.day === dateKeyInZone(appTimeZone.current) &&
			this.skipped.current.keys.includes(intentionMatchKey(intention.goalId, intention.text))
		);
	}

	skipToday(intention: Intention) {
		const day = dateKeyInZone(appTimeZone.current);
		const keys = this.skipped.current.day === day ? this.skipped.current.keys : [];
		this.skipped.current = {
			day,
			keys: [...new Set([...keys, intentionMatchKey(intention.goalId, intention.text)])]
		};
	}

	restoreToday(intention: Intention) {
		if (!this.isSkipped(intention)) return;
		const key = intentionMatchKey(intention.goalId, intention.text);
		this.skipped.current = {
			...this.skipped.current,
			keys: this.skipped.current.keys.filter((skipped) => skipped !== key)
		};
	}
}

export const notDones = new NotDonesStore();
