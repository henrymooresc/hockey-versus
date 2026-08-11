"use client";

import { useEffect, useState } from "react";

interface Stored<T> {
  url: string;
  data: T | null;
  error: string | null;
}

export interface Fetched<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetches `url` and derives `loading` during render, rather than setting it
 * inside the effect.
 *
 * The stored result carries the url it came from, so `loading` is simply
 * `stored.url !== url`. That is already true on the render that changes the
 * url. The panels used to call `setLoading(true)` and clear the old data at
 * the top of the effect, which reached the same place one render later and is
 * what `react-hooks/set-state-in-effect` warns about.
 *
 * Pass `null` to hold off. The hook fires nothing and stays loading. Panels
 * use that while they wait for the season list, so the first request never
 * goes out unfiltered and then races the filtered one.
 *
 * A superseded request aborts, so a slow answer cannot replace a newer one.
 */
export function useFetchedData<T>(url: string | null): Fetched<T> {
  const [stored, setStored] = useState<Stored<T> | null>(null);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Request failed");
        return body as T;
      })
      .then((data) => setStored({ url, data, error: null }))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setStored({ url, data: null, error: err.message });
      });

    return () => controller.abort();
  }, [url]);

  if (url === null || stored?.url !== url) {
    return { data: null, error: null, loading: true };
  }
  return { data: stored.data, error: stored.error, loading: false };
}
