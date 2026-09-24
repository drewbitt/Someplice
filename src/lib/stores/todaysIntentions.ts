import { PersistedState } from 'runed';

// Values are stored as raw strings (not JSON) to keep the existing localStorage format.
// null means "no draft saved"; '' means the user cleared the editor — the two
// must stay distinct so a cleared draft is not repopulated from intentions.
const stringSerializer = {
	serialize: (value: string | null) => (value === null ? 'null' : value),
	deserialize: (value: string) => (value === 'null' ? null : value)
};

export const todaysIntentions = new PersistedState<string | null>('todaysIntentions', null, {
	serializer: stringSerializer
});
