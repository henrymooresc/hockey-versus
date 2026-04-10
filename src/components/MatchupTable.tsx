"use client";

import { useState, useEffect } from "react";
import type { MatchupPlayer, RivalGameHistory, StandingsEntry } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors } from "@/lib/team-colors";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export type PlayerPosition = string | null;

type SkaterSortKey = "rivalry" | "points" | "shots" | "hits" | "blocks" | "pim" | "toi";
type CenterSortKey = "rivalry" | "points" | "shots" | "hits" | "blocks" | "pim" | "foPct" | "toi";
type GoalieSortKey = "rivalry" | "savePct" | "goals" | "assists" | "shots" | "toi";
type SortKey = SkaterSortKey | CenterSortKey | GoalieSortKey;

export type ColumnMode = "skater" | "center" | "goalie";

function getSkaterSortValue(m: MatchupPlayer, key: SkaterSortKey | CenterSortKey): number {
  switch (key) {
    case "rivalry": return m.rivalryScore;
    case "points": return m.stats.points - m.oppStats.points;
    case "shots": return m.stats.individualShots - m.oppStats.individualShots;
    case "hits": return m.stats.hits - m.oppStats.hits;
    case "blocks": return m.stats.blocks - m.oppStats.blocks;
    case "pim": return m.oppStats.penalties - m.stats.penalties;
    case "foPct": {
      const total = m.stats.faceoffWins + m.oppStats.faceoffWins;
      return total > 0 ? m.stats.faceoffWins / total : 0;
    }
    case "toi": return m.toiSharedSeconds;
  }
}

function getGoalieSortValue(m: MatchupPlayer, key: GoalieSortKey): number {
  switch (key) {
    case "rivalry": return m.rivalryScore;
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

const SKATER_ROW_GRID = "30px 1fr 40px 40px 40px 40px 40px 40px";
const CENTER_ROW_GRID = "30px 1fr 40px 40px 40px 40px 40px 40px 40px";
const GOALIE_ROW_GRID = "30px 1fr 40px 60px 40px 40px 40px";

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

type HeaderColumn = { label: string; key: SortKey };

const SKATER_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "BLK", key: "blocks" },
  { label: "PIM", key: "pim" },
];

const CENTER_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "BLK", key: "blocks" },
  { label: "PIM", key: "pim" },
  { label: "FO%", key: "foPct" },
];

const GOALIE_HEADER_COLUMNS: HeaderColumn[] = [
  { label: "RIV", key: "rivalry" },
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

function foPct(wins: number, oppWins: number): string {
  const total = wins + oppWins;
  if (total === 0) return "\u2014";
  return ((wins / total) * 100).toFixed(0) + "%";
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ── Player Bio Card ────────────────────────────────────────────────────────

function PlayerBioCard({
  matchup,
  standings,
}: {
  matchup: MatchupPlayer;
  standings: StandingsEntry | null;
}) {
  const teamColors = getTeamColors(matchup.teamAbbrev);
  const age = computeAge(matchup.birthDate);

  return (
    <div
      className="rounded-lg border bg-gray-800/60 p-3"
      style={{ borderColor: teamColors.primary + "60" }}
    >
      <div className="flex items-center gap-3">
        {matchup.headshotUrl ? (
          <img
            src={matchup.headshotUrl}
            alt={`${matchup.firstName} ${matchup.lastName}`}
            className="rounded-lg object-cover shrink-0"
            style={{
              width: 64,
              height: 64,
              minWidth: 64,
              maxWidth: 64,
              boxShadow: `0 0 12px ${teamColors.primary}30`,
              border: `2px solid ${teamColors.primary}80`,
            }}
          />
        ) : (
          <div
            className="rounded-lg bg-gray-700"
            style={{ width: 64, height: 64, border: `2px solid ${teamColors.primary}80` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">
            {matchup.firstName} {matchup.lastName}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {matchup.teamLogoUrl && (
              <img src={matchup.teamLogoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
            )}
            <span className="text-xs" style={{ color: teamColors.primary }}>
              {matchup.teamAbbrev}
            </span>
            {matchup.sweaterNumber && (
              <span className="text-xs text-gray-400">#{matchup.sweaterNumber}</span>
            )}
            {matchup.position && (
              <span className={`text-xs ${matchup.position === "D" ? "text-blue-400" : "text-gray-400"}`}>
                {matchup.position}
              </span>
            )}
          </div>
          {age !== null && (
            <div className="text-[10px] text-gray-500 mt-0.5">Age {age}</div>
          )}
        </div>
      </div>

      {/* Team standings info */}
      {standings && (
        <div
          className="mt-2 flex items-center justify-between rounded px-2 py-1 text-[10px]"
          style={{ backgroundColor: teamColors.primary + "15", borderLeft: `3px solid ${teamColors.primary}` }}
        >
          <span className="text-gray-400">
            <span className="font-bold text-white">{standings.points}</span> pts
          </span>
          <span className="text-gray-400">
            {standings.wins}-{standings.losses}-{standings.otLosses}
          </span>
          <span className="text-gray-400">
            L10: <span className="text-gray-300">{standings.l10Record}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Rivalry Trend Chart ────────────────────────────────────────────────────

function RivalryTrendChart({ history }: { history: RivalGameHistory[] }) {
  if (history.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
        Rivalry Score by Game
      </div>
      <div style={{ width: "100%", height: 100 }}>
        <ResponsiveContainer>
          <LineChart data={history} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#6B7280" }}
              axisLine={{ stroke: "#374151" }}
              tickLine={false}
              interval={history.length > 10 ? Math.floor(history.length / 6) : 0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#6B7280" }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(value) => [Number(value).toFixed(1), "Rivalry"]}
            />
            <Line
              type="monotone"
              dataKey="rivalryScore"
              stroke="#60A5FA"
              strokeWidth={2}
              dot={{ r: 3, fill: "#60A5FA" }}
              activeDot={{ r: 5, fill: "#3B82F6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Expanded Detail Components ─────────────────────────────────────────────

function DetailStatRow({
  label,
  mine,
  opp,
  higherIsBetter = true,
}: {
  label: string;
  mine: number | string;
  opp: number | string;
  higherIsBetter?: boolean;
}) {
  const numMine = typeof mine === "number" ? mine : parseFloat(mine as string);
  const numOpp = typeof opp === "number" ? opp : parseFloat(opp as string);
  const iWin = higherIsBetter ? numMine > numOpp : numMine < numOpp;
  const theyWin = higherIsBetter ? numOpp > numMine : numOpp < numMine;

  return (
    <div className="grid grid-cols-3 items-center py-1.5">
      <div className={`text-right font-mono text-xs font-semibold ${iWin ? "text-green-400" : theyWin ? "text-red-400" : "text-gray-300"}`}>
        {mine}
      </div>
      <div className="text-center text-[10px] text-gray-500">{label}</div>
      <div className={`text-left font-mono text-xs font-semibold ${theyWin ? "text-green-400" : iWin ? "text-red-400" : "text-gray-300"}`}>
        {opp}
      </div>
    </div>
  );
}

function DetailSectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-2 pb-0.5 text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{label}</span>
    </div>
  );
}

function SkaterExpandedDetail({
  matchup,
  showFaceoffs,
  playerName,
  playerId,
  standings,
}: {
  matchup: MatchupPlayer;
  showFaceoffs: boolean;
  playerName: string;
  playerId: number;
  standings: Map<string, StandingsEntry>;
}) {
  const { stats, oppStats } = matchup;
  const [history, setHistory] = useState<RivalGameHistory[] | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/rival-history?opponentId=${matchup.playerId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.games ?? []))
      .catch(() => setHistory([]));
  }, [playerId, matchup.playerId]);

  const teamStandings = matchup.teamAbbrev ? standings.get(matchup.teamAbbrev) ?? null : null;

  return (
    <div className="px-2 pb-3">
      {/* Player bio card */}
      <div className="mb-3">
        <PlayerBioCard matchup={matchup} standings={teamStandings} />
      </div>

      {/* Stat comparison */}
      <div className="grid grid-cols-3 items-center pb-1 mb-1 border-b border-gray-700/50">
        <div className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{playerName}</div>
        <div />
        <div className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{matchup.firstName[0]}. {matchup.lastName}</div>
      </div>

      <div className="text-center py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rivalry Score </span>
        <span className={`font-mono text-sm font-bold ${matchup.rivalryScore > 0 ? "text-green-400" : matchup.rivalryScore < 0 ? "text-red-400" : "text-gray-400"}`}>
          {matchup.rivalryScore.toFixed(2)}
        </span>
      </div>

      <DetailSectionLabel label="Scoring" />
      <DetailStatRow label="Goals" mine={stats.goals} opp={oppStats.goals} />
      <DetailStatRow label="Assists" mine={stats.assists} opp={oppStats.assists} />
      <DetailStatRow label="Points" mine={stats.points} opp={oppStats.points} />
      <DetailStatRow label="Shots" mine={stats.individualShots} opp={oppStats.individualShots} />

      <DetailSectionLabel label="Physical" />
      <DetailStatRow label="Hits" mine={stats.hits} opp={oppStats.hits} />
      <DetailStatRow label="Blocks" mine={stats.blocks} opp={oppStats.blocks} />
      <DetailStatRow label="Penalties" mine={stats.penalties} opp={oppStats.penalties} higherIsBetter={false} />

      {showFaceoffs && (
        <>
          <DetailSectionLabel label="Faceoffs" />
          <DetailStatRow label="FO Wins" mine={stats.faceoffWins} opp={oppStats.faceoffWins} />
          <DetailStatRow
            label="FO%"
            mine={foPct(stats.faceoffWins, oppStats.faceoffWins)}
            opp={foPct(oppStats.faceoffWins, stats.faceoffWins)}
          />
        </>
      )}

      {/* Trend chart */}
      {history && history.length > 0 && <RivalryTrendChart history={history} />}
      {history === null && (
        <div className="mt-2 text-center">
          <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
        </div>
      )}
    </div>
  );
}

function GoalieExpandedDetail({
  matchup,
  playerPosition,
  playerName,
  playerId,
  standings,
}: {
  matchup: MatchupPlayer;
  playerPosition: PlayerPosition;
  playerName: string;
  playerId: number;
  standings: Map<string, StandingsEntry>;
}) {
  const { stats, oppStats } = matchup;
  const isPlayerGoalie = playerPosition === "G";
  const [history, setHistory] = useState<RivalGameHistory[] | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/rival-history?opponentId=${matchup.playerId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.games ?? []))
      .catch(() => setHistory([]));
  }, [playerId, matchup.playerId]);

  const teamStandings = matchup.teamAbbrev ? standings.get(matchup.teamAbbrev) ?? null : null;

  if (isPlayerGoalie) {
    const mySaves = stats.individualShots - stats.goals;
    const oppSaves = oppStats.individualShots - oppStats.goals;
    return (
      <div className="px-2 pb-3">
        <div className="mb-3">
          <PlayerBioCard matchup={matchup} standings={teamStandings} />
        </div>

        <div className="grid grid-cols-3 items-center pb-1 mb-1 border-b border-gray-700/50">
          <div className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{playerName}</div>
          <div />
          <div className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{matchup.firstName[0]}. {matchup.lastName}</div>
        </div>

        <div className="text-center py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rivalry Score </span>
          <span className={`font-mono text-sm font-bold ${matchup.rivalryScore > 0 ? "text-green-400" : matchup.rivalryScore < 0 ? "text-red-400" : "text-gray-400"}`}>
            {matchup.rivalryScore.toFixed(2)}
          </span>
        </div>

        <DetailSectionLabel label="Save Performance" />
        <DetailStatRow label="Shots Faced" mine={stats.individualShots} opp={oppStats.individualShots} />
        <DetailStatRow label="Saves" mine={mySaves} opp={oppSaves} />
        <DetailStatRow label="Goals Against" mine={stats.goals} opp={oppStats.goals} higherIsBetter={false} />
        <DetailStatRow
          label="Save %"
          mine={savePct(stats.individualShots, stats.goals)}
          opp={savePct(oppStats.individualShots, oppStats.goals)}
        />

        <DetailSectionLabel label="On-Ice Team" />
        <DetailStatRow label="Goals" mine={stats.goalsFor} opp={oppStats.goalsFor} />
        <DetailStatRow label="Shots" mine={stats.shotsFor} opp={oppStats.shotsFor} />

        {history && history.length > 0 && <RivalryTrendChart history={history} />}
        {history === null && (
          <div className="mt-2 text-center">
            <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
          </div>
        )}
      </div>
    );
  }

  // Selected player is a skater, opponent is a goalie
  const shotsOnGoalie = stats.individualShots;
  const goalsOnGoalie = stats.goals;
  const shootingPct = shotsOnGoalie > 0 ? ((goalsOnGoalie / shotsOnGoalie) * 100).toFixed(1) + "%" : "\u2014";
  const goalieSavePct = savePct(shotsOnGoalie, goalsOnGoalie);

  return (
    <div className="px-2 pb-3">
      <div className="mb-3">
        <PlayerBioCard matchup={matchup} standings={teamStandings} />
      </div>

      <div className="text-center py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rivalry Score </span>
        <span className={`font-mono text-sm font-bold ${matchup.rivalryScore > 0 ? "text-green-400" : matchup.rivalryScore < 0 ? "text-red-400" : "text-gray-400"}`}>
          {matchup.rivalryScore.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Skater stats against this goalie */}
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2 text-center">{playerName}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Shots on Goal</span>
              <span className="font-mono text-white">{stats.individualShots}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Goals Scored</span>
              <span className={`font-mono ${stats.goals > 0 ? "text-green-400 font-bold" : "text-gray-300"}`}>{stats.goals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Assists</span>
              <span className={`font-mono ${stats.assists > 0 ? "text-green-400 font-bold" : "text-gray-300"}`}>{stats.assists}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Points</span>
              <span className="font-mono font-bold text-white">{stats.points}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700/50 pt-1.5">
              <span className="text-gray-400">Shooting %</span>
              <span className="font-mono text-white">{shootingPct}</span>
            </div>
          </div>
        </div>

        {/* Goalie's stats */}
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2 text-center">{matchup.firstName[0]}. {matchup.lastName}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Shots Faced</span>
              <span className="font-mono text-white">{shotsOnGoalie}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Goals Against</span>
              <span className={`font-mono ${goalsOnGoalie > 0 ? "text-red-400" : "text-gray-300"}`}>{goalsOnGoalie}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Saves</span>
              <span className="font-mono text-white">{shotsOnGoalie - goalsOnGoalie}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700/50 pt-1.5">
              <span className="text-gray-400">Save %</span>
              <span className="font-mono font-bold text-white">{goalieSavePct}</span>
            </div>
          </div>
        </div>
      </div>

      {history && history.length > 0 && <RivalryTrendChart history={history} />}
      {history === null && (
        <div className="mt-2 text-center">
          <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
        </div>
      )}
    </div>
  );
}

// ── Matchup Row ────────────────────────────────────────────────────────────

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
  const emptyCount = mode === "goalie" ? 5 : mode === "center" ? 8 : 7;
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
          <div className="text-xs font-semibold text-white truncate">
            {(matchup.sweaterNumber || matchup.position) && (
              <span className="text-gray-500" style={{ marginRight: 8 }}>
                {matchup.sweaterNumber && `#${matchup.sweaterNumber}`}
                {matchup.sweaterNumber && matchup.position && " "}
                {matchup.position && <span className={matchup.position === "D" ? "text-blue-400" : "text-gray-400"}>{matchup.position}</span>}
              </span>
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
              <RivalryScoreCell score={matchup.rivalryScore} />
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
  const [standings, setStandings] = useState<Map<string, StandingsEntry>>(new Map());

  useEffect(() => {
    fetch("/api/standings")
      .then((r) => r.json())
      .then((d) => {
        const map = new Map<string, StandingsEntry>();
        for (const s of d.standings ?? []) {
          map.set(s.abbrev, s);
        }
        setStandings(map);
      })
      .catch(() => {});
  }, []);

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
