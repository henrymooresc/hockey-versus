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
  /** Nothing to show yet, and a request is in flight. */
  loading: boolean;
  /** Showing the previous result while the next one loads. */
  refreshing: boolean;
}

export interface FetchedOptions {
  /**
   * Hold the previous result on screen while the next one loads, instead of
   * clearing to null.
   *
   * Use this wherever a control derives its size from the data. A panel whose
   * toolbar counts and dropdown options come from the response collapses to
   * empty during a refetch, and a flex row reflows around it. Measured on the
   * rivals panel: the season toggle moved 80px left and back within 240ms, so
   * the button jumped out from under the pointer that had just clicked it.
   *
   * Leave it off when the new request means something different, such as a
   * different game. Stale content would then read as current.
   */
  keepPreviousData?: boolean;
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
export function useFetchedData<T>(
  url: string | null,
  { keepPreviousData = false }: FetchedOptions = {}
): Fetched<T> {
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

  const isCurrent = url !== null && stored?.url === url;
  if (isCurrent) {
    return {
      data: stored.data,
      error: stored.error,
      loading: false,
      refreshing: false,
    };
  }

  // A previous result exists but belongs to an older url. Keeping it on screen
  // holds the layout still while the next one loads.
  const canKeep = keepPreviousData && stored?.data != null;
  return {
    data: canKeep ? stored.data : null,
    error: null,
    loading: !canKeep,
    refreshing: canKeep,
  };
}
