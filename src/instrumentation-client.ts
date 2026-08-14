/**
 * Sentry in the browser. Next loads this automatically for the client bundle.
 *
 * This is the file that ships to every visitor, so it stays minimal. No session
 * replay: it is the heaviest thing the SDK offers, both in bundle size and in
 * quota, and it records what a visitor did rather than what broke.
 *
 * `enabled` is false outside production, so `npm run dev` never sends anything.
 * See `sentry.server.config.ts` for the rest of the reasoning.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
  enabled: process.env.VERCEL_ENV === "production",
});

/** Reports navigation timing for App Router route changes. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
