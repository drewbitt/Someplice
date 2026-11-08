// Shared clock arithmetic. Database timestamps are real UTC milliseconds, unlike
// the fake-Z wall dates used to label intention days.
export const FOCUS_KINDS = ['pomodoro', 'hourglass', 'break'] as const;
export const FOCUS_STATUSES = ['running', 'paused', 'completed', 'cancelled'] as const;

export function createSessionId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	// Self-hosted installations can use HTTP on a LAN, where randomUUID is
	// unavailable. getRandomValues is also available in insecure contexts.
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface ClockSession {
	plannedSeconds: number;
	elapsedSeconds: number;
	lastStartedAt: number | null;
}

export function elapsedSeconds(session: ClockSession, now: number): number {
	return Math.min(
		session.plannedSeconds,
		session.elapsedSeconds +
			(session.lastStartedAt === null ? 0 : Math.max(0, (now - session.lastStartedAt) / 1000))
	);
}

export function formatClock(seconds: number): string {
	const whole = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(whole / 60)
		.toString()
		.padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}
