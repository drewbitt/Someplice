import { writable } from 'svelte/store';

export const goalPageError = writable<string | null>(null);
