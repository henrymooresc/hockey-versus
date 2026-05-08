"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl pt-20 text-center">
      <h2 className="text-2xl font-bold text-red-300">Something went wrong</h2>
      <p className="mt-2 text-sm text-gray-400">
        {error.message || "Unexpected error"}
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-md border border-red-700/60 bg-red-900/30 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-900/50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
