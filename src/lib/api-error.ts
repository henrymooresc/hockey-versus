import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * The 500 response every API route returns when it catches something.
 *
 * Reporting has to happen here rather than through Sentry's `onRequestError`
 * hook. That hook only sees errors that escape a route, and every route in this
 * app catches its own and returns a 500 itself — so the hook fired for nothing
 * and production errors stayed invisible even after Sentry was wired up.
 *
 * This also stops discarding the stack. The old line logged
 * `err instanceof Error ? err.message : err`, which threw away the one part
 * that says where the failure was.
 *
 * @param context Short label naming the route, used as the log prefix and as a
 *   Sentry tag so issues group per route rather than by message text.
 */
export function apiError(context: string, err: unknown) {
  console.error(`${context}:`, err);
  Sentry.captureException(err, { tags: { route: context } });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
