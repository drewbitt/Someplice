import { writable } from 'svelte/store';

export const goalPageErrorStore = writable<string | null>(null);
