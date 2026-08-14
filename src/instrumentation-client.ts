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

/**
 * `NEXT_PUBLIC_VERCEL_ENV`, not `VERCEL_ENV`. Next only inlines variables with
 * the `NEXT_PUBLIC_` prefix into the browser bundle, so the bare name is
 * `undefined` here — which silently left `enabled` false and reported nothing
 * from the client. Vercel populates the prefixed one for exactly this.
 */
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: vercelEnv ?? "development",
  enabled: vercelEnv === "production",
});

/** Reports navigation timing for App Router route changes. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
