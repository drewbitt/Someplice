import type { Intention } from '#lib/trpc/types.js';
import { intentionMatchKey } from '#lib/utils/notDones.js';
import { PersistedState } from 'runed';

// Browser preferences only; recovery history comes from the page's server load.
class NotDoneSkips {
	private skipped = new PersistedState<{ day: string; keys: string[] }>('notDones:skipped', {
		day: '',
		keys: []
	});

	isSkipped(intention: Intention, day: string) {
		return (
			this.skipped.current.day === day &&
			this.skipped.current.keys.includes(intentionMatchKey(intention.goalId, intention.text))
		);
	}

	skipToday(intention: Intention, day: string) {
		const keys = this.skipped.current.day === day ? this.skipped.current.keys : [];
		this.skipped.current = {
			day,
			keys: [...new Set([...keys, intentionMatchKey(intention.goalId, intention.text)])]
		};
	}

	restoreToday(intention: Intention, day: string) {
		if (!this.isSkipped(intention, day)) return;
		const key = intentionMatchKey(intention.goalId, intention.text);
		this.skipped.current = {
			...this.skipped.current,
			keys: this.skipped.current.keys.filter((skipped) => skipped !== key)
		};
	}
}

export const notDoneSkips = new NotDoneSkips();
