/**
 * The installation timezone both server and client day math runs in. Set from
 * the root layout's `data.timeZone` (the server-resolved stored setting);
 * until then the browser's own zone is the best guess — it is also what the
 * first `ensureTimeZone` call persists.
 */
let current = $state<string | null>(null);

export const appTimeZone = {
	get current(): string {
		return current ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	},
	set(timeZone: string) {
		current = timeZone;
	}
};
