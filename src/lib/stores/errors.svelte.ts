class TimedErrorStore {
	current = $state<string | null>(null);

	/**
	 * Set an error message for a given time. Default is 6 seconds.
	 * @param message Message to display
	 * @param timeout Time in ms to display the message
	 */
	setError(message: string | null, timeout = 6000) {
		this.current = message;
		setTimeout(() => (this.current = null), timeout);
	}
}

export const goalPageErrorStore = new TimedErrorStore();
export const todayPageErrorStore = new TimedErrorStore();
export const journeyPageErrorStore = new TimedErrorStore();
