import { writable } from 'svelte/store';

function createTimedErrorStore() {
	const { subscribe, set, update } = writable<null | string>(null);

	/**
	 * Set an error message for a given time. Default is 6 seconds.
	 * @param message Message to display
	 * @param timeout Time in ms to display the message
	 */
	function setError(message: string | null, timeout = 6000) {
		set(message);
		setTimeout(() => set(null), timeout);
	}

	return {
		subscribe,
		setError,
		update
	};
}

export const goalPageErrorStore = createTimedErrorStore();
export const todayPageErrorStore = createTimedErrorStore();
export const journeyPageErrorStore = createTimedErrorStore();
