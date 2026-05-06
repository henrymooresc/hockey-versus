"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PlayerSearchResult } from "@/types/versus";
import { SoloAnalysis } from "./SoloAnalysis";
import { HeadToHeadComparison } from "./HeadToHeadComparison";

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
      className={`flex cursor-pointer items-center gap-4 px-5 py-3 transition-all duration-150 hover:bg-gray-700/80 hover:pl-6 active:scale-[0.99] active:bg-gray-600/60 ${
        isSelected ? "bg-gray-700/80 pl-6" : ""
      }`}
    >
      {player.headshotUrl ? (
        <img src={player.headshotUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-600 transition-all duration-150 group-hover:ring-gray-400" />
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
        className="flex w-full items-center gap-3 px-5 py-3 hover:bg-gray-800/80 active:bg-gray-700/60 transition-all duration-150 active:scale-[0.995]"
      >
        {logoUrl ? (
          <span className="flex items-center justify-center rounded" style={{ width: 32, height: 32, background: "rgba(255,255,255,0.15)" }}>
            <img src={logoUrl} alt={teamAbbrev} className="object-contain" style={{ width: 26, height: 26 }} />
          </span>
        ) : (
          <div className="h-8 w-8" />
        )}
        <span className="flex-1 text-left font-semibold text-gray-200">{teamName}</span>
        <span className="text-xs text-gray-500 mr-2">{players.length}</span>
        <span className={`text-gray-500 text-sm transition-transform duration-200 inline-block ${open ? "rotate-180" : ""}`}>▼</span>
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

  const divisionOrder = ["Atlantic", "Metropolitan", "Central", "Pacific", "Other"];

  const divisionMap = useMemo(() => {
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
    const map = new Map<string, Map<string, { teamName: string; logoUrl: string | null; players: PlayerSearchResult[] }>>();
    for (const div of divisionOrder) map.set(div, new Map());

    for (const [abbrev, group] of teamMap.entries()) {
      const div = abbrevToDivision(abbrev);
      map.get(div)!.set(abbrev, group);
    }

    return map;
  }, [filtered]);

  return (
    <ul className="overflow-auto scroll-smooth rounded-xl border border-gray-700/70 bg-gray-800/90 backdrop-blur-sm" style={{ maxHeight: "28rem" }}>
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
    const params = new URLSearchParams({ onRoster: "true", minGames: "10" });
    if (debouncedQuery.length >= 2) params.set("q", debouncedQuery);
    if (exclude?.id) params.set("versusWith", String(exclude.id));
    fetch(`/api/players/search?${params}`)
      .then((r) => r.json())
      .then((data) => setResults(data.players ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, exclude?.id]);

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
        <div className="flex items-center gap-4 rounded-xl border-2 border-blue-500/70 bg-gradient-to-r from-blue-950/40 to-gray-800 px-5 py-4 shadow-lg shadow-blue-500/5 transition-all duration-300">
          {selected.headshotUrl ? (
            <img src={selected.headshotUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-400/70" />
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
            className="rounded-full p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 active:scale-90 transition-all duration-150"
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
          className="w-full rounded-xl border border-gray-700 bg-gray-800/80 px-5 py-4 text-white placeholder-gray-500 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-gray-800"
        />
      )}

      {!selected && (
        <PlayerList
          results={results}
          exclude={exclude}
          selected={selected}
          onSelect={handleSelect}
          isFiltering={debouncedQuery.length >= 2}
          loading={loading}
        />
      )}
    </div>
  );
}

export function PlayerSearch() {
  const [playerA, setPlayerA] = useState<PlayerSearchResult | null>(null);
  const [playerB, setPlayerB] = useState<PlayerSearchResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const handleToggleCompare = () => {
    if (compareMode) {
      setPlayerB(null);
      setCompareMode(false);
    } else {
      setCompareMode(true);
    }
  };

  return (
    <div className="w-full">
      {/* Top controls row */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        {/* Compare toggle */}
        <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Head-to-Head</span>
        <button
          onClick={handleToggleCompare}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
            compareMode
              ? "border-blue-500 bg-blue-600"
              : "border-gray-600 bg-gray-700"
          }`}
          role="switch"
          aria-checked={compareMode}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
              compareMode ? "translate-x-[22px]" : "translate-x-[2px]"
            }`}
          />
        </button>
        </div>
      </div>

      {/* Player selection area */}
      {!compareMode ? (
        // Solo mode: single player picker
        <div>
          <PlayerCombobox
            label="Select a Player"
            selected={playerA}
            onSelect={setPlayerA}
            exclude={null}
          />

          {playerA && (
            <SoloAnalysis player={playerA} />
          )}
        </div>
      ) : (
        // Compare mode: two player pickers side by side
        <div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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

          {playerA && playerB && (
            <HeadToHeadComparison playerA={playerA} playerB={playerB} />
          )}
        </div>
      )}
    </div>
  );
}
