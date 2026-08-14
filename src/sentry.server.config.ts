/**
 * Sentry for the Node.js runtime — the API routes and anything rendered on the
 * server. Loaded by `instrumentation.ts`.
 *
 * Errors only. No tracing, no profiling, no session replay:
 *
 * - `tracesSampleRate: 0` because performance is already measured by Speed
 *   Insights, and traces are what exhaust a free-tier quota fastest. The
 *   quota is worth spending on the thing that was actually invisible, which
 *   is a route returning 500.
 * - An absent DSN disables the SDK rather than failing. That keeps local
 *   development and CI working with no secret, and means a missing environment
 *   variable in production costs error reporting rather than the site.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  /** Vercel sets this. It separates preview noise from real production errors. */
  environment: process.env.VERCEL_ENV ?? "development",
  /**
   * Off in development. Without it every deliberate error thrown while working
   * on a route lands in the same place as a real production failure.
   */
  enabled: process.env.VERCEL_ENV === "production",
});
