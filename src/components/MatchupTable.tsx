"use client";

import { useState } from "react";
import type { MatchupPlayer, StandingsEntry } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import { useStandings } from "@/hooks/useStandings";
import { SkaterExpandedDetail, GoalieExpandedDetail, type PlayerPosition } from "./ExpandedDetail";

function positionColor(pos: string | null | undefined): string {
  switch (pos) {
    case "C": return "text-amber-400";
    case "L": return "text-cyan-400";
    case "R": return "text-violet-400";
    case "D": return "text-blue-400";
    default:  return "text-gray-400";
  }
}

type SkaterSortKey = "rivalry" | "games" | "toi" | "points" | "shots" | "hits" | "blocks" | "pim";
type CenterSortKey = "rivalry" | "games" | "toi" | "points" | "shots" | "hits" | "blocks" | "pim" | "foPct";
type GoalieSortKey = "rivalry" | "games" | "toi" | "savePct" | "goals" | "assists" | "shots";
type SortKey = SkaterSortKey | CenterSortKey | GoalieSortKey;

export type ColumnMode = "skater" | "center" | "goalie";

function getSkaterSortValue(m: MatchupPlayer, key: SkaterSortKey | CenterSortKey): number {
  switch (key) {
    case "rivalry": return m.rivalryScore;
    case "games": return m.gamesShared;
    case "toi": return m.toiSharedSeconds;
    case "points": return m.stats.points - m.oppStats.points;
    case "shots": return m.stats.individualShots - m.oppStats.individualShots;
    case "hits": return m.stats.hits - m.oppStats.hits;
    case "blocks": return m.stats.blocks - m.oppStats.blocks;
    case "pim": return m.oppStats.penalties - m.stats.penalties;
    case "foPct": {
      const total = m.stats.faceoffWins + m.oppStats.faceoffWins;
      return total > 0 ? m.stats.faceoffWins / total : 0;
    }
  }
}

function getGoalieSortValue(m: MatchupPlayer, key: GoalieSortKey): number {
  switch (key) {
    case "rivalry": return m.rivalryScore;
    case "games": return m.gamesShared;
    case "toi": return m.toiSharedSeconds;
    case "savePct": {
      const sog = m.stats.individualShots;
      return sog > 0 ? (sog - m.stats.goals) / sog : 0;
    }
    case "goals": return m.stats.goals;
    case "assists": return m.stats.assists;
    case "shots": return m.stats.individualShots;
  }
}

function getSortValue(m: MatchupPlayer, key: SortKey, mode: ColumnMode): number {
  return mode === "goalie"
    ? getGoalieSortValue(m, key as GoalieSortKey)
    : getSkaterSortValue(m, key as SkaterSortKey | CenterSortKey);
}

const SKATER_ROW_GRID = "30px 1fr 40px 32px 58px 40px 40px 40px 40px 40px";
const CENTER_ROW_GRID = "30px 1fr 40px 32px 58px 40px 40px 40px 40px 40px 40px";
const GOALIE_ROW_GRID = "30px 1fr 40px 32px 58px 60px 40px 40px 40px";

function DiffCell({ diff }: { diff: number }) {
  const label = diff > 0 ? `+${diff}` : `${diff}`;
  return (
    <div className={`text-center font-mono text-[11px] ${diff > 0 ? "text-green-400 font-bold" : diff < 0 ? "text-red-400 font-bold" : "text-gray-500"}`}>
      {diff === 0 ? "0" : label}
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

function RivalryScoreCell({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center font-mono text-[11px]">
      <span className={score > 0 ? "text-green-400 font-bold" : score < 0 ? "text-red-400 font-bold" : "text-gray-500"}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function savePct(shotsAgainst: number, goalsAgainst: number): string {
  if (shotsAgainst === 0) return "1.000";
  return ((shotsAgainst - goalsAgainst) / shotsAgainst).toFixed(3);
}

function foPct(wins: number, oppWins: number): string {
  const total = wins + oppWins;
  if (total === 0) return "\u2014";
  return ((wins / total) * 100).toFixed(0) + "%";
}

type HeaderColumn = { label: string; key: SortKey };

const SKATER_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
  { label: "GP", key: "games" },
  { label: "TOI", key: "toi" },
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "BLK", key: "blocks" },
  { label: "PIM", key: "pim" },
];

const CENTER_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
  { label: "GP", key: "games" },
  { label: "TOI", key: "toi" },
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "BLK", key: "blocks" },
  { label: "PIM", key: "pim" },
  { label: "FO%", key: "foPct" },
];

const GOALIE_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
  { label: "GP", key: "games" },
  { label: "TOI", key: "toi" },
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
  columns: HeaderColumn[];
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

function MatchupRow({
  matchup,
  mode = "skater",
  expanded,
  onToggle,
  playerPosition,
  playerName,
  playerId,
  standings,
}: {
  matchup: MatchupPlayer;
  mode?: ColumnMode;
  expanded: boolean;
  onToggle: () => void;
  playerPosition: PlayerPosition;
  playerName: string;
  playerId: number;
  standings: Map<string, StandingsEntry>;
}) {
  const hasHistory = matchup.gamesShared > 0;
  const gridTemplate = mode === "goalie" ? GOALIE_ROW_GRID : mode === "center" ? CENTER_ROW_GRID : SKATER_ROW_GRID;
  const emptyCount = mode === "goalie" ? 7 : mode === "center" ? 9 : 8;
  const isClickable = hasHistory;
  const teamColors = getTeamColors(matchup.teamAbbrev);

  return (
    <div
      className={`rounded-lg border transition-colors duration-150 ${
        expanded
          ? "bg-gray-800/80"
          : "border-gray-700/50 bg-gray-800/60 hover:bg-gray-800"
      }`}
      style={expanded ? { borderColor: teamColors.primary + "60" } : undefined}
    >
      <div
        className={`grid items-center ${isClickable ? "cursor-pointer" : ""}`}
        style={{ gridTemplateColumns: gridTemplate, padding: "10px 10px", gap: 6 }}
        onClick={isClickable ? onToggle : undefined}
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
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
            <span
              className="flex shrink-0 items-center gap-1"
              title={matchup.teamName ?? matchup.teamAbbrev ?? "Not on an active roster"}
            >
              {matchup.teamLogoUrl ? (
                <span className="flex shrink-0 items-center justify-center rounded" style={{ width: 26, height: 26, background: "rgba(255,255,255,0.10)" }}>
                  <img src={matchup.teamLogoUrl} alt="" className="object-contain" style={{ width: 20, height: 20 }} />
                </span>
              ) : (
                <span
                  className="flex shrink-0 items-center justify-center rounded text-[14px] font-bold text-gray-500"
                  style={{ width: 26, height: 26, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(156,163,175,0.35)" }}
                >
                  ?
                </span>
              )}
              {matchup.teamAbbrev && (
                <span
                  className="text-[11px] font-bold tracking-wide"
                  style={{ color: getTeamDisplayColor(matchup.teamAbbrev) }}
                >
                  {matchup.teamAbbrev}
                </span>
              )}
            </span>
            {(matchup.sweaterNumber || matchup.position) && (
              <span className="text-xs text-gray-500">
                {matchup.sweaterNumber && `#${matchup.sweaterNumber}`}
                {matchup.sweaterNumber && matchup.position && " "}
                {matchup.position && <span className={positionColor(matchup.position)}>{matchup.position}</span>}
              </span>
            )}
            <span className="truncate">{matchup.firstName[0]}. {matchup.lastName}</span>
          </div>
        </div>
        {hasHistory ? (
          mode === "goalie" ? (
            <>
              <RivalryScoreCell score={matchup.rivalryScore} />
              <GoalieStatValue value={matchup.gamesShared} className="text-gray-400" />
              <GoalieStatValue value={formatSecondsToHMS(matchup.toiSharedSeconds)} className="text-gray-400 text-[10px]" />
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
              <RivalryScoreCell score={matchup.rivalryScore} />
              <GoalieStatValue value={matchup.gamesShared} className="text-gray-400" />
              <GoalieStatValue value={formatSecondsToHMS(matchup.toiSharedSeconds)} className="text-gray-400 text-[10px]" />
              <DiffCell diff={matchup.stats.points - matchup.oppStats.points} />
              <DiffCell diff={matchup.stats.individualShots - matchup.oppStats.individualShots} />
              <DiffCell diff={matchup.stats.hits - matchup.oppStats.hits} />
              <DiffCell diff={matchup.stats.blocks - matchup.oppStats.blocks} />
              <DiffCell diff={matchup.oppStats.penalties - matchup.stats.penalties} />
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
      {expanded && hasHistory && (
        <div className="border-t border-gray-700/50 mx-2 mb-1 mt-0">
          {mode === "goalie" ? (
            <GoalieExpandedDetail matchup={matchup} playerPosition={playerPosition} playerName={playerName} playerId={playerId} standings={standings} />
          ) : (
            <SkaterExpandedDetail matchup={matchup} showFaceoffs={mode === "center"} playerName={playerName} playerId={playerId} standings={standings} />
          )}
        </div>
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
  playerPosition = null,
  playerName = "",
  playerId = 0,
}: {
  label: string;
  matchups: MatchupPlayer[];
  collapsible?: boolean;
  defaultVisible?: number;
  mode?: ColumnMode;
  playerPosition?: PlayerPosition;
  playerName?: string;
  playerId?: number;
}) {
  const defaultSort: SortKey = "rivalry";
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const standings = useStandings();

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
      <StatHeader sortKey={sortKey} sortDir={sortDir} onSort={handleSort} columns={columns} gridTemplate={gridTemplate} />
      <div className={`flex flex-col gap-3 ${showAll ? "max-h-[600px] overflow-y-auto" : ""}`}>
        {visible.map((m) => (
          <MatchupRow
            key={m.playerId}
            matchup={m}
            mode={mode}
            expanded={expandedId === m.playerId}
            onToggle={() => setExpandedId(expandedId === m.playerId ? null : m.playerId)}
            playerPosition={playerPosition}
            playerName={playerName}
            playerId={playerId}
            standings={standings}
          />
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
