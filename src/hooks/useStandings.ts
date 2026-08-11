"use client";

import { useState, useEffect } from "react";
import type { StandingsEntry } from "@/types/versus";

let cachedStandings: Map<string, StandingsEntry> | null = null;
let fetchPromise: Promise<Map<string, StandingsEntry>> | null = null;

function fetchStandings(): Promise<Map<string, StandingsEntry>> {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/standings")
    .then((r) => r.json())
    .then((d) => {
      const map = new Map<string, StandingsEntry>();
      for (const s of d.standings ?? []) {
        map.set(s.abbrev, s);
      }
      cachedStandings = map;
      return map;
    })
    .catch(() => new Map<string, StandingsEntry>())
    .finally(() => { fetchPromise = null; });
  return fetchPromise;
}

export function useStandings(): Map<string, StandingsEntry> {
  const [standings, setStandings] = useState<Map<string, StandingsEntry>>(
    () => cachedStandings ?? new Map()
  );

  useEffect(() => {
    // The initialiser above already reads the cache, so only a cold start
    // needs to fetch.
    if (cachedStandings) return;
    fetchStandings().then(setStandings);
  }, []);

  return standings;
}
