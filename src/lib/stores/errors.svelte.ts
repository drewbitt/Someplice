class TimedErrorStore {
	current = $state<string | null>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Set an error message for a given time. Default is 6 seconds.
	 * @param message Message to display
	 * @param timeout Time in ms to display the message
	 */
	setError(message: string | null, timeout = 6000) {
		// Cancel the outstanding timer: an older message's expiry must not wipe
		// a newer one early.
		if (this.timer !== null) clearTimeout(this.timer);
		this.current = message;
		this.timer = setTimeout(() => {
			this.current = null;
			this.timer = null;
		}, timeout);
	}
}

export const goalPageErrorStore = new TimedErrorStore();
export const todayPageErrorStore = new TimedErrorStore();
export const journeyPageErrorStore = new TimedErrorStore();
