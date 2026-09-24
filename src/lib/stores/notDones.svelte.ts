import { trpc } from '$src/lib/trpc/client';
import { localePreviousDate, type IntentionRow, type IntentionStatus } from '$src/lib/utils';
import { SvelteDate } from 'svelte/reactivity';

/**
 * Intentions from the most recent days before today, shared by the NotDones
 * propagator panel and the today list's paren inflation. Loaded once on
 * demand; `refresh` re-queries after mutations (dismiss, review marks).
 */
class NotDonesStore {
	recentIntentions = $state<IntentionRow[]>([]);
	loaded = $state(false);

	async refresh(days = 3) {
		const endDate = localePreviousDate();
		const startDate = new SvelteDate(endDate);
		startDate.setDate(startDate.getDate() - (days - 1));

		this.recentIntentions = await trpc().intentions.list.query({ startDate, endDate });
		this.loaded = true;
	}

	removeIntentions(ids: (number | null)[]) {
		const removed = new Set(ids);
		this.recentIntentions = this.recentIntentions.filter((intention) => !removed.has(intention.id));
	}

	markStatuses(ids: (number | null)[], status: IntentionStatus) {
		const marked = new Set(ids);
		this.recentIntentions = this.recentIntentions.map((intention) =>
			marked.has(intention.id) ? { ...intention, status } : intention
		);
	}
}

export const notDones = new NotDonesStore();
