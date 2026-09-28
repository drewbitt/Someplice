import { trpc } from '$src/lib/trpc/client';
import type { Intention, IntentionStatus } from '$src/lib/trpc/types';
import { localePreviousDate } from '$src/lib/utils';
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
			const endDate = localePreviousDate();
			const startDate = new SvelteDate(endDate);
			startDate.setDate(startDate.getDate() - (days - 1));

			this.recentIntentions = await trpc().intentions.list.query({ startDate, endDate });
		})().finally(() => {
			this.inflight = null;
		});
		return this.inflight;
	}

	async markStatuses(ids: (number | null)[], status: IntentionStatus) {
		await this.inflight;
		const marked = new Set(ids);
		this.recentIntentions = this.recentIntentions.map((intention) =>
			marked.has(intention.id) ? { ...intention, status } : intention
		);
	}
}

export const notDones = new NotDonesStore();
