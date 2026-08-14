/**
 * Sentry for the edge runtime — middleware and any route opted into it.
 *
 * This site runs nothing on the edge today. The file exists because
 * `instrumentation.ts` imports it when `NEXT_RUNTIME` is `edge`, and because
 * the first route that opts in would otherwise report nothing and nobody would
 * notice. Settings mirror the server config; see it for the reasoning.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
  enabled: process.env.VERCEL_ENV === "production",
});
