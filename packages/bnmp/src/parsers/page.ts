import { z } from 'zod';

/** Spring `Page<T>` envelope used by every /api/pesquisa-pecas/* listing. */
export function pagedSchema<T extends z.ZodTypeAny>(content: T) {
  return z.object({
    content: z.array(content),
    last: z.boolean(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    number: z.number().int().nonnegative(),
  });
}

export type Paged<T> = {
  content: T[];
  last: boolean;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};
