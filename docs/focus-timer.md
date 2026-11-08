# Focus timer

The timer sits above Today and remains available on other pages while a session is active.

- **Pomodoro:** an uninterrupted countdown, defaulting to 25 minutes. It cannot pause. Cancelling requires confirmation and earns no completed Pomodoro.
- **Hourglass:** a flexible countdown that can pause and resume. Saving early records elapsed work and excludes paused time.
- **Breaks:** start explicitly, with defaults of 5 minutes or 20 minutes for a long break. A long break is suggested after every fourth completed Pomodoro.

Durations can be changed before starting. Each session can be attached to a pending intention or left unassigned. The chosen intention stays fixed through reordering, completion, deferral and navigation. Finishing a timer does not complete the intention or set a daily review verdict.

Sessions are stored in SQLite, with one running or paused timer per installation. Reloading or returning after browser sleep restores the clock from timestamps. Expiration records at most the planned duration and never starts another session automatically. Retried starts and stale controls cannot create duplicate sessions or change a newer timer.

History retains the original starting day and intention text, including after an intention is deleted. Today shows recent sessions and totals; interrupted Pomodoros and breaks do not contribute recorded work time.

Sound, desktop notifications, reassignment and Journey integration are not implemented yet. The clock recovers after all tabs have been closed, but does not deliver an alarm while they are closed.
