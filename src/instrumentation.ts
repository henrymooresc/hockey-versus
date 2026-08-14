/**
 * Next.js instrumentation hook. Runs once per runtime, before anything else.
 *
 * `onRequestError` is the point of this file. Before it, a route that threw
 * logged to `console.error` and reached Vercel's log viewer, where nobody was
 * looking — a 500 in production was invisible unless a visitor mentioned it.
 * This hands the same errors to Sentry with the request attached.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
