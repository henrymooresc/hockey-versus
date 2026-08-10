import { NextResponse } from "next/server";

/**
 * Cache policy for the API routes.
 *
 * Every page is a client shell that fetches from `/api`, so without these
 * headers each page view reaches Postgres. Vercel's CDN reads `s-maxage` and
 * `stale-while-revalidate`, which keeps the database out of the request path
 * for all but the first hit in each window.
 *
 * `s-maxage` binds the shared CDN cache only. Browsers get `max-age=0` and
 * revalidate, so a reload after a recompute shows the new numbers. The
 * revalidation goes to the CDN, not to the database.
 *
 * Apply a policy to success responses only. A 4xx or 5xx must never cache,
 * because the CDN would then serve the error to everyone for the whole window.
 */

/**
 * Data derived from the database. Only the ingestion scripts and
 * `compute:versus` change it, and both run at most once a day.
 */
export const DERIVED =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/**
 * Data that follows the NHL schedule: recent games, upcoming games, standings.
 * A short window, because these change while games are played.
 */
export const SCHEDULE =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

/** Returns a JSON response that carries the given cache policy. */
export function cachedJson<T>(data: T, policy: string) {
  return NextResponse.json(data, { headers: { "Cache-Control": policy } });
}
