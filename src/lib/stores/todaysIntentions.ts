import { PersistedState } from 'runed';

// Values are stored as raw strings (not JSON) to keep the existing localStorage format.
const stringSerializer = {
	serialize: (value: string) => value,
	deserialize: (value: string) => value
};

export const todaysIntentions = new PersistedState('todaysIntentions', '', {
	serializer: stringSerializer
});
