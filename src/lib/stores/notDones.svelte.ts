import { trpc } from '#lib/trpc/client.js';
import type { Intention, IntentionStatus } from '#lib/trpc/types.js';
import { wallClockInZone } from '#lib/utils/index.js';
import { appTimeZone } from '#lib/stores/timezone.svelte.js';
import { SvelteDate } from 'svelte/reactivity';

/**
 * Intentions from the most recent days before today, shared by the NotDones
 * propagator panel and the today list's paren inflation.
 */
class NotDonesStore {
	recentIntentions = $state<Intention[]>([]);
	private inflight: Promise<void> | null = null;

	refresh(days = 3) {
		this.inflight ??= (async () => {
			const endDate = wallClockInZone(appTimeZone.current);
			endDate.setUTCDate(endDate.getUTCDate() - 1);
			const startDate = new SvelteDate(endDate);
			startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

			this.recentIntentions = await trpc().intentions.list.query({ startDate, endDate });
		})().finally(() => {
			this.inflight = null;
		});
		return this.inflight;
	}

	async markStatuses(ids: (number | null)[], status: IntentionStatus) {
		await this.inflight?.catch(() => undefined);
		const marked = new Set(ids);
		this.recentIntentions = this.recentIntentions.map((intention) =>
			marked.has(intention.id) ? { ...intention, status } : intention
		);
	}
}

export const notDones = new NotDonesStore();
