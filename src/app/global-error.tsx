"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last resort. `error.tsx` sits inside the root layout, so it cannot catch
 * an error thrown by the layout itself — this one replaces the whole document
 * when that happens, which is why it has to render its own `<html>` and
 * `<body>`.
 *
 * It is deliberately plain. Styling here would mean depending on the stylesheet,
 * and a failure in the layout is exactly when that may not have loaded. The
 * inline styles keep it readable on a default white page.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[layout error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "5rem 1.5rem",
          textAlign: "center",
          color: "#1f2937",
          background: "#ffffff",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Bar Down Data
        </h1>
        <p style={{ color: "#6b7280" }}>
          Something went wrong loading the page.
        </p>
        {/* A plain anchor, not `next/link`, and the one place that is correct.
            This boundary only renders when the root layout itself threw, so the
            React tree and its router are the things that just failed. `Link`
            would attempt a client-side navigation through them; a hard request
            is the only reliable way out. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ color: "#1d4ed8" }}>
          Back to the home page
        </a>
      </body>
    </html>
  );
}
