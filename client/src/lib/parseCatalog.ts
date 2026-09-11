import type { ZodType } from 'zod';
import { ApiError } from './apiClient.js';

export function parseCatalog<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(500, 'INVALID_RESPONSE', 'Unexpected catalog response');
  }
  return result.data;
}
