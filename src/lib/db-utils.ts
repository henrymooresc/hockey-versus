import { sql } from "drizzle-orm";

/**
 * Unwrap Drizzle raw SQL results into a typed array.
 * Handles both array results and `{ rows: [...] }` shapes.
 */
export function unwrapRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as Record<string, unknown>).rows as T[] | undefined) ?? [];
}

export type GameTypeFilter = "regular" | "playoffs" | "both";

/**
 * Parse a `gameType` query string param into a normalized filter.
 * Defaults to "regular" — playoffs are opt-in.
 */
export function parseGameTypeFilter(raw: string | null | undefined): GameTypeFilter {
  if (raw === "playoffs") return "playoffs";
  if (raw === "both") return "both";
  return "regular";
}

/**
 * Build a SQL fragment that filters versus_stats.game_type based on the toggle.
 * Returns an empty fragment for "both" so it can always be appended after AND.
 */
export function gameTypeClause(filter: GameTypeFilter) {
  if (filter === "regular") return sql`AND game_type = 2`;
  if (filter === "playoffs") return sql`AND game_type = 3`;
  return sql``;
}
