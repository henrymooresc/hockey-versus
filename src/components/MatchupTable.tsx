"use client";

import { useState } from "react";
import type { MatchupPlayer } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";

type SkaterSortKey = "points" | "shots" | "hits" | "pim" | "toi";
type CenterSortKey = "points" | "shots" | "hits" | "pim" | "foPct" | "toi";
type GoalieSortKey = "savePct" | "goals" | "assists" | "shots" | "toi";
type SortKey = SkaterSortKey | CenterSortKey | GoalieSortKey;

export type ColumnMode = "skater" | "center" | "goalie";

function getSkaterSortValue(m: MatchupPlayer, key: SkaterSortKey | CenterSortKey): number {
  switch (key) {
    case "points": return m.stats.points - m.oppStats.points;
    case "shots": return m.stats.shotsFor - m.oppStats.shotsFor;
    case "hits": return m.stats.hits - m.oppStats.hits;
    case "pim": return m.stats.penalties - m.oppStats.penalties;
    case "foPct": {
      const total = m.stats.faceoffWins + m.oppStats.faceoffWins;
      return total > 0 ? m.stats.faceoffWins / total : 0;
    }
    case "toi": return m.toiSharedSeconds;
  }
}

function getGoalieSortValue(m: MatchupPlayer, key: GoalieSortKey): number {
  switch (key) {
    case "savePct": {
      const sog = m.stats.individualShots;
      return sog > 0 ? (sog - m.stats.goals) / sog : 0;
    }
    case "goals": return m.stats.goals;
    case "assists": return m.stats.assists;
    case "shots": return m.stats.individualShots;
    case "toi": return m.toiSharedSeconds;
  }
}

function getSortValue(m: MatchupPlayer, key: SortKey, mode: ColumnMode): number {
  return mode === "goalie"
    ? getGoalieSortValue(m, key as GoalieSortKey)
    : getSkaterSortValue(m, key as SkaterSortKey | CenterSortKey);
}

const SKATER_ROW_GRID = "30px 1fr 40px 40px 40px 40px";
const CENTER_ROW_GRID = "30px 1fr 40px 40px 40px 40px 40px";
const GOALIE_ROW_GRID = "30px 1fr 60px 40px 40px 40px";

function StatValue({ mine, opp }: { mine: number; opp: number }) {
  const diff = mine - opp;
  return (
    <div className="flex items-center justify-center font-mono text-[11px]" style={{ gap: 2 }}>
      <span
        className={diff > 0 ? "text-green-400 font-bold" : diff < 0 ? "text-red-400 font-bold" : "text-gray-300"}
        style={{ width: 16, textAlign: "right", display: "inline-block" }}
      >
        {mine}
      </span>
      <span className="text-gray-700">&ndash;</span>
      <span className="text-gray-500" style={{ width: 16, textAlign: "left", display: "inline-block" }}>
        {opp}
      </span>
    </div>
  );
}

function GoalieStatValue({ value, className }: { value: string | number; className?: string }) {
  return (
    <div className={`flex items-center justify-center font-mono text-[11px] ${className ?? "text-gray-300"}`}>
      {value}
    </div>
  );
}

function savePct(shotsAgainst: number, goalsAgainst: number): string {
  if (shotsAgainst === 0) return ".000";
  return ((shotsAgainst - goalsAgainst) / shotsAgainst).toFixed(3);
}

const SKATER_HEADER_COLUMNS: { label: string; key: SkaterSortKey }[] = [
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "PIM", key: "pim" },
];

const CENTER_HEADER_COLUMNS: { label: string; key: CenterSortKey }[] = [
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "PIM", key: "pim" },
  { label: "FO%", key: "foPct" },
];

const GOALIE_HEADER_COLUMNS: { label: string; key: GoalieSortKey }[] = [
  { label: "SV%", key: "savePct" },
  { label: "G", key: "goals" },
  { label: "A", key: "assists" },
  { label: "SOG", key: "shots" },
];

function StatHeader({
  sortKey,
  sortDir,
  onSort,
  columns,
  gridTemplate,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  columns: { label: string; key: SortKey }[];
  gridTemplate: string;
}) {
  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: gridTemplate, padding: "0 10px", gap: 6, marginBottom: 6 }}
    >
      <div />
      <div />
      {columns.map((col) => {
        const isActive = sortKey === col.key;
        return (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            className={`text-center text-[10px] uppercase tracking-wider cursor-pointer transition-colors ${
              isActive ? "text-blue-400 font-bold" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {col.label}
            {isActive && (
              <span style={{ marginLeft: 2, fontSize: 8 }}>
                {sortDir === "desc" ? "\u25BC" : "\u25B2"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function foPct(wins: number, oppWins: number): string {
  const total = wins + oppWins;
  if (total === 0) return "\u2014";
  return ((wins / total) * 100).toFixed(0) + "%";
}

function MatchupRow({
  matchup,
  mode = "skater",
}: {
  matchup: MatchupPlayer;
  mode?: ColumnMode;
}) {
  const hasHistory = matchup.gamesShared > 0;
  const gridTemplate = mode === "goalie" ? GOALIE_ROW_GRID : mode === "center" ? CENTER_ROW_GRID : SKATER_ROW_GRID;
  const emptyCount = mode === "center" ? 5 : 4;

  return (
    <div
      className="grid items-center rounded-lg border border-gray-700/50 bg-gray-800/60 py-3 transition-colors duration-150 hover:bg-gray-800"
      style={{ gridTemplateColumns: gridTemplate, padding: "10px 10px", gap: 6 }}
    >
      {matchup.headshotUrl ? (
        <img
          src={matchup.headshotUrl}
          alt=""
          className="rounded-full object-cover ring-1 ring-gray-600"
          style={{ width: 30, height: 30 }}
        />
      ) : (
        <div className="rounded-full bg-gray-600" style={{ width: 36, height: 36 }} />
      )}
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white truncate">
          {matchup.sweaterNumber && (
            <span className="text-gray-500" style={{ marginRight: 8 }}>#{matchup.sweaterNumber}</span>
          )}
          {matchup.firstName[0]}. {matchup.lastName}
        </div>
        <div className="text-[10px] text-gray-500 truncate" style={{ marginTop: 2 }}>
          {hasHistory ? (
            <>
              {matchup.gamesShared}G &middot; {formatSecondsToHMS(matchup.toiSharedSeconds)}
            </>
          ) : (
            "No history"
          )}
        </div>
      </div>
      {hasHistory ? (
        mode === "goalie" ? (
          <>
            <GoalieStatValue
              value={savePct(matchup.stats.individualShots, matchup.stats.goals)}
              className="text-white font-bold"
            />
            <GoalieStatValue value={matchup.stats.goals} className={matchup.stats.goals > 0 ? "text-green-400 font-bold" : "text-gray-300"} />
            <GoalieStatValue value={matchup.stats.assists} className={matchup.stats.assists > 0 ? "text-green-400 font-bold" : "text-gray-300"} />
            <GoalieStatValue value={matchup.stats.individualShots} />
          </>
        ) : (
          <>
            <StatValue mine={matchup.stats.points} opp={matchup.oppStats.points} />
            <StatValue mine={matchup.stats.shotsFor} opp={matchup.oppStats.shotsFor} />
            <StatValue mine={matchup.stats.hits} opp={matchup.oppStats.hits} />
            <StatValue mine={matchup.stats.penalties} opp={matchup.oppStats.penalties} />
            {mode === "center" && (
              <GoalieStatValue
                value={foPct(matchup.stats.faceoffWins, matchup.oppStats.faceoffWins)}
                className="text-gray-300"
              />
            )}
          </>
        )
      ) : (
        <>
          {Array.from({ length: emptyCount }, (_, i) => <div key={i} />)}
        </>
      )}
    </div>
  );
}

export function PositionGroup({
  label,
  matchups,
  collapsible = false,
  defaultVisible = 6,
  mode = "skater",
}: {
  label: string;
  matchups: MatchupPlayer[];
  collapsible?: boolean;
  defaultVisible?: number;
  mode?: ColumnMode;
}) {
  const defaultSort: SortKey = mode === "goalie" ? "savePct" : "points";
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (matchups.length === 0) return null;

  const columns = mode === "goalie" ? GOALIE_HEADER_COLUMNS : mode === "center" ? CENTER_HEADER_COLUMNS : SKATER_HEADER_COLUMNS;
  const gridTemplate = mode === "goalie" ? GOALIE_ROW_GRID : mode === "center" ? CENTER_ROW_GRID : SKATER_ROW_GRID;

  const sorted = [...matchups].sort((a, b) => {
    if (a.gamesShared > 0 && b.gamesShared === 0) return -1;
    if (a.gamesShared === 0 && b.gamesShared > 0) return 1;
    if (a.gamesShared === 0 && b.gamesShared === 0) return 0;
    const diff = getSortValue(b, sortKey, mode) - getSortValue(a, sortKey, mode);
    return sortDir === "desc" ? diff : -diff;
  });

  const visible = collapsible && !showAll ? sorted.slice(0, defaultVisible) : sorted;
  const hasMore = collapsible && matchups.length > defaultVisible;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="rounded-xl border border-gray-700/40 bg-gray-900/50" style={{ padding: "14px 10px" }}>
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500" style={{ marginBottom: 12, paddingLeft: 4 }}>
        {label}
      </h4>
      <StatHeader sortKey={sortKey} sortDir={sortDir} onSort={handleSort} columns={columns as { label: string; key: SortKey }[]} gridTemplate={gridTemplate} />
      <div className={`flex flex-col gap-3 ${showAll ? "max-h-[600px] overflow-y-auto" : ""}`}>
        {visible.map((m) => (
          <MatchupRow key={m.playerId} matchup={m} mode={mode} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{ marginTop: 10 }}
          className="w-full rounded-lg border border-gray-700/50 bg-gray-800/40 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
        >
          {showAll
            ? "Show less"
            : `Show ${matchups.length - defaultVisible} more`}
        </button>
      )}
    </div>
  );
}
