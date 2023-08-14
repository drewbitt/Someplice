import { writable } from 'svelte/store';

const createLocalStorageStore = (key: string, initialValue = '') => {
	const { subscribe, set } = writable(initialValue);

	return {
		subscribe,
		initialize: () => {
			const storedValue = localStorage.getItem(key) || initialValue;
			set(storedValue);
		},
		updateValue: (value: string) => {
			localStorage.setItem(key, value);
			set(value);
		},
		clear: () => {
			localStorage.removeItem(key);
			set(initialValue);
		}
	};
};

export const todaysIntentionsStore = createLocalStorageStore('todaysIntentions');
