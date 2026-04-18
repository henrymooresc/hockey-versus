/**
 * Unwrap Drizzle raw SQL results into a typed array.
 * Handles both array results and `{ rows: [...] }` shapes.
 */
export function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as Record<string, unknown>).rows as T[] | undefined) ?? [];
}
