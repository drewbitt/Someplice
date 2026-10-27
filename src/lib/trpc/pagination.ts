import { z } from 'zod';

export const PaginationSchema = z.object({
	limit: z.int().nonnegative().optional(),
	offset: z.int().nonnegative().optional()
});
