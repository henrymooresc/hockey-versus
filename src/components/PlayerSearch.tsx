"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSearchResult } from "@/types/versus";

const DIVISIONS: Record<string, string[]> = {
  Atlantic:     ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
  Metropolitan: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
  Central:      ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
  Pacific:      ["ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"],
};

function abbrevToDivision(abbrev: string): string {
  for (const [division, abbrevs] of Object.entries(DIVISIONS)) {
    if (abbrevs.includes(abbrev)) return division;
  }
  return "Other";
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PlayerRow({
  player,
  selected,
  onSelect,
}: {
  player: PlayerSearchResult;
  selected: PlayerSearchResult | null;
  onSelect: (p: PlayerSearchResult) => void;
}) {
  const isSelected = selected?.id === player.id;
  return (
    <li
      onClick={() => onSelect(player)}
      className={`flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-700 ${
        isSelected ? "bg-gray-700" : ""
      }`}
    >
      {player.headshotUrl ? (
        <img src={player.headshotUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-600" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-gray-600 ring-2 ring-gray-500" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white">
          {player.firstName} {player.lastName}
        </div>
        <div className="text-sm text-gray-400">{player.position ?? "—"}</div>
      </div>
    </li>
  );
}

function TeamGroup({
  teamAbbrev,
  teamName,
  logoUrl,
  players,
  selected,
  onSelect,
  defaultOpen,
}: {
  teamAbbrev: string;
  teamName: string;
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
    <li className="border-b border-gray-700 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 hover:bg-gray-750 transition-colors"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={teamAbbrev} className="h-8 w-8 object-contain" />
        ) : (
          <div className="h-8 w-8" />
        )}
        <span className="flex-1 text-left font-semibold text-gray-200">{teamName}</span>
        <span className="text-xs text-gray-500 mr-2">{players.length}</span>
        <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="border-t border-gray-700 bg-gray-850">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DivisionSection({
  division,
  teams,
  selected,
  onSelect,
  isFiltering,
}: {
  division: string;
  teams: Map<string, { teamName: string; logoUrl: string | null; players: PlayerSearchResult[] }>;
  selected: PlayerSearchResult | null;
  onSelect: (p: PlayerSearchResult) => void;
  isFiltering: boolean;
}) {
  const sorted = Array.from(teams.entries()).sort(([, a], [, b]) =>
    a.teamName.localeCompare(b.teamName)
  );

  return (
    <li>
      <div className="bg-gray-950 px-5 py-2 sticky top-0 z-10">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{division}</span>
      </div>
      <ul>
        {sorted.map(([abbrev, group]) => (
          <TeamGroup
            key={abbrev}
            teamAbbrev={abbrev}
            teamName={group.teamName}
            logoUrl={group.logoUrl}
            players={group.players}
            selected={selected}
            onSelect={onSelect}
            defaultOpen={isFiltering}
          />
        ))}
      </ul>
    </li>
  );
}

function PlayerList({
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

  // Group by team
  const teamMap = new Map<string, { teamName: string; logoUrl: string | null; players: PlayerSearchResult[] }>();
  for (const player of filtered) {
    const key = player.teamAbbrev ?? "—";
    if (!teamMap.has(key)) {
      teamMap.set(key, {
        teamName: player.teamName ?? key,
        logoUrl: player.teamLogoUrl,
        players: [],
      });
    }
    teamMap.get(key)!.players.push(player);
  }

  // Group teams by division
  const divisionMap = new Map<string, Map<string, { teamName: string; logoUrl: string | null; players: PlayerSearchResult[] }>>();
  const divisionOrder = ["Atlantic", "Metropolitan", "Central", "Pacific", "Other"];
  for (const div of divisionOrder) divisionMap.set(div, new Map());

  for (const [abbrev, group] of teamMap.entries()) {
    const div = abbrevToDivision(abbrev);
    divisionMap.get(div)!.set(abbrev, group);
  }

  return (
    <ul className="overflow-auto rounded-xl border border-gray-700 bg-gray-800" style={{ maxHeight: "28rem" }}>
      {loading ? (
        <li className="px-5 py-4 text-sm text-gray-500">Loading...</li>
      ) : filtered.length === 0 ? (
        <li className="px-5 py-4 text-sm text-gray-500">No players found</li>
      ) : (
        divisionOrder
          .filter((div) => divisionMap.get(div)!.size > 0)
          .map((div) => (
            <DivisionSection
              key={div}
              division={div}
              teams={divisionMap.get(div)!}
              selected={selected}
              onSelect={onSelect}
              isFiltering={isFiltering}
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
    const url =
      debouncedQuery.length >= 2
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
    <div className="flex flex-col gap-3">
      <label className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>

      {selected ? (
        <div className="flex items-center gap-4 rounded-xl border-2 border-blue-500 bg-gray-800 px-5 py-4">
          {selected.headshotUrl ? (
            <img src={selected.headshotUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-400" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gray-600" />
          )}
          <div className="flex-1">
            <div className="text-lg font-bold text-white">
              {selected.firstName} {selected.lastName}
            </div>
            <div className="text-sm text-gray-400">
              {selected.teamName ?? selected.teamAbbrev ?? "—"} &middot; {selected.position ?? "—"}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="rounded-full p-1 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-xl border border-gray-600 bg-gray-800 px-5 py-4 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      <PlayerList
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
    <div className="w-full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <PlayerCombobox label="Player 1" selected={playerA} onSelect={setPlayerA} exclude={playerB} />
        <PlayerCombobox label="Player 2" selected={playerB} onSelect={setPlayerB} exclude={playerA} />
      </div>
      <button
        onClick={handleCompare}
        disabled={!playerA || !playerB}
        className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Compare Players
      </button>
    </div>
  );
}
