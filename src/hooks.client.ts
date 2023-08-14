import { todaysIntentionsStore } from './lib/stores/localStorage';

// Clear on application restart
// Only clear in production as dev mode HMR will cause this to run on every file change
if (import.meta.env.PROD) {
	todaysIntentionsStore.clear();
}
