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

function PlayerCombobox({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: PlayerSearchResult | null;
  onSelect: (player: PlayerSearchResult | null) => void;
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
      <ul className="mt-2 max-h-72 overflow-auto rounded-lg border border-gray-700 bg-gray-800">
        {loading ? (
          <li className="px-4 py-3 text-sm text-gray-500">Loading...</li>
        ) : results.length === 0 ? (
          <li className="px-4 py-3 text-sm text-gray-500">No players found</li>
        ) : (
          results.map((player) => (
            <li
              key={player.id}
              onClick={() => handleSelect(player)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-700 ${
                selected?.id === player.id ? "bg-gray-700" : ""
              }`}
            >
              {player.headshotUrl ? (
                <img src={player.headshotUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-600" />
              )}
              <div>
                <div className="font-medium">
                  {player.firstName} {player.lastName}
                </div>
                <div className="text-xs text-gray-400">
                  {player.teamAbbrev ?? "—"} &middot; {player.position ?? "—"}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
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
        />
        <PlayerCombobox
          label="Player 2"
          selected={playerB}
          onSelect={setPlayerB}
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
