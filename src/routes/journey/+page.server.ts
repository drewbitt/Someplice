import { redirect } from '@sveltejs/kit';

export const load = () => {
	throw redirect(301, '/journey/1'); // Permanent redirect
};
