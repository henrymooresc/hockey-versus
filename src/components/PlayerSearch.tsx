"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSearchResult } from "@/types/versus";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TeamGroup({
  abbrev,
  logoUrl,
  players,
  selected,
  onSelect,
  defaultOpen,
}: {
  abbrev: string;
  logoUrl: string | null;
  players: PlayerSearchResult[];
  selected: PlayerSearchResult | null;
  onSelect: (p: PlayerSearchResult) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-gray-900 px-4 py-2 hover:bg-gray-800"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={abbrev} className="h-5 w-5 object-contain" />
        ) : (
          <div className="h-5 w-5" />
        )}
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
          {abbrev}
        </span>
        <span className="text-xs text-gray-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul>
          {players.map((player) => (
            <li
              key={player.id}
              onClick={() => onSelect(player)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-700 ${
                selected?.id === player.id ? "bg-gray-700" : ""
              }`}
            >
              {player.headshotUrl ? (
                <img src={player.headshotUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gray-600" />
              )}
              <div>
                <div className="font-medium">
                  {player.firstName} {player.lastName}
                </div>
                <div className="text-xs text-gray-400">{player.position ?? "—"}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TeamList({
  results,
  exclude,
  selected,
  onSelect,
  isFiltering,
  loading,
}: {
  results: PlayerSearchResult[];
  exclude: PlayerSearchResult | null;
  selected: PlayerSearchResult | null;
  onSelect: (p: PlayerSearchResult) => void;
  isFiltering: boolean;
  loading: boolean;
}) {
  const filtered = results.filter((p) => p.id !== exclude?.id);
  const groups = new Map<string, { logoUrl: string | null; players: PlayerSearchResult[] }>();
  for (const player of filtered) {
    const key = player.teamAbbrev ?? "—";
    if (!groups.has(key)) groups.set(key, { logoUrl: player.teamLogoUrl, players: [] });
    groups.get(key)!.players.push(player);
  }

  return (
    <ul className="mt-2 max-h-96 overflow-auto rounded-lg border border-gray-700 bg-gray-800">
      {loading ? (
        <li className="px-4 py-3 text-sm text-gray-500">Loading...</li>
      ) : filtered.length === 0 ? (
        <li className="px-4 py-3 text-sm text-gray-500">No players found</li>
      ) : (
        Array.from(groups.entries()).map(([abbrev, group]) => (
          <TeamGroup
            key={abbrev}
            abbrev={abbrev}
            logoUrl={group.logoUrl}
            players={group.players}
            selected={selected}
            onSelect={onSelect}
            defaultOpen={isFiltering}
          />
        ))
      )}
    </ul>
  );
}

function PlayerCombobox({
  label,
  selected,
  onSelect,
  exclude,
}: {
  label: string;
  selected: PlayerSearchResult | null;
  onSelect: (player: PlayerSearchResult | null) => void;
  exclude: PlayerSearchResult | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    setLoading(true);
    const url = debouncedQuery.length >= 2
      ? `/api/players/search?q=${encodeURIComponent(debouncedQuery)}`
      : `/api/players/search`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setResults(data.players ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const handleSelect = useCallback(
    (player: PlayerSearchResult) => {
      onSelect(player);
      setQuery("");
    },
    [onSelect]
  );

  return (
    <div className="flex flex-col">
      <label className="mb-1 block text-sm font-medium text-gray-400">
        {label}
      </label>
      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500 bg-gray-800 px-4 py-3">
          {selected.headshotUrl && (
            <img src={selected.headshotUrl} alt="" className="h-10 w-10 rounded-full" />
          )}
          <div className="flex-1">
            <div className="font-semibold">
              {selected.firstName} {selected.lastName}
            </div>
            <div className="text-sm text-gray-400">
              {selected.teamAbbrev} &middot; {selected.position}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player name..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
      <TeamList
        results={results}
        exclude={exclude}
        selected={selected}
        onSelect={handleSelect}
        isFiltering={debouncedQuery.length >= 2}
        loading={loading}
      />
    </div>
  );
}

export function PlayerSearch() {
  const router = useRouter();
  const [playerA, setPlayerA] = useState<PlayerSearchResult | null>(null);
  const [playerB, setPlayerB] = useState<PlayerSearchResult | null>(null);

  const handleCompare = () => {
    if (playerA && playerB) {
      router.push(`/versus/${playerA.id}/${playerB.id}`);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlayerCombobox
          label="Player 1"
          selected={playerA}
          onSelect={setPlayerA}
          exclude={playerB}
        />
        <PlayerCombobox
          label="Player 2"
          selected={playerB}
          onSelect={setPlayerB}
          exclude={playerA}
        />
      </div>
      <button
        onClick={handleCompare}
        disabled={!playerA || !playerB}
        className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Compare
      </button>
    </div>
  );
}
