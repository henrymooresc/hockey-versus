"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Catches a render error anywhere below the root layout. Errors in the layout
 * itself escape this one — `global-error.tsx` takes those.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console line stays. It is what shows up while running locally, where
    // Sentry is deliberately disabled.
    console.error("[route error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl pt-20 text-center">
      <h2 className="text-2xl font-bold text-red-300">Something went wrong</h2>
      <p className="mt-2 text-base text-gray-400">
        {error.message || "Unexpected error"}
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-md border border-red-700/60 bg-red-900/30 px-4 py-2 text-base font-medium text-red-200 hover:bg-red-900/50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
