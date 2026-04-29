"use client";

import type { MatchupPlayer, PlayerSearchResult, StandingsEntry } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { MatchupRadarChart, type RadarCategory } from "./MatchupRadarChart";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";

interface Team {
  id: number;
  abbrev: string;
  name: string;
  logoUrl: string | null;
}

function weightedMean(
  rows: MatchupPlayer[],
  getStat: (m: MatchupPlayer) => number
): number {
  let sum = 0;
  let weight = 0;
  for (const r of rows) {
    const w = r.toiSharedSeconds;
    if (w > 0) {
      sum += getStat(r) * w;
      weight += w;
    }
  }
  return weight === 0 ? 0 : sum / weight;
}

function StatRow({
  label,
  mine,
  opp,
  higherIsBetter = true,
  decimals = 1,
}: {
  label: string;
  mine: number;
  opp: number;
  higherIsBetter?: boolean;
  decimals?: number;
}) {
  const iWin = higherIsBetter ? mine > opp : mine < opp;
  const theyWin = higherIsBetter ? opp > mine : opp < mine;
  return (
    <div className="grid grid-cols-3 items-center py-1.5">
      <div className={`text-right font-mono text-xs font-semibold ${iWin ? "text-green-400" : theyWin ? "text-red-400" : "text-gray-300"}`}>
        {mine.toFixed(decimals)}
      </div>
      <div className="text-center text-[10px] text-gray-500">{label}</div>
      <div className={`text-left font-mono text-xs font-semibold ${theyWin ? "text-green-400" : iWin ? "text-red-400" : "text-gray-300"}`}>
        {opp.toFixed(decimals)}
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-2 pb-0.5 text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{label}</span>
    </div>
  );
}

function ColumnHeaders({ playerName, teamLabel }: { playerName: string; teamLabel: string }) {
  return (
    <div className="grid grid-cols-3 items-center pb-1 mb-1 border-b border-gray-700/50">
      <div className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{playerName}</div>
      <div />
      <div className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{teamLabel}</div>
    </div>
  );
}

export function TeamMatchupSummary({
  player,
  team,
  matchups,
  standings,
}: {
  player: PlayerSearchResult;
  team: Team;
  matchups: MatchupPlayer[];
  standings: StandingsEntry | null;
}) {
  const withHistory = matchups.filter((m) => m.toiSharedSeconds > 0);

  if (withHistory.length === 0) {
    return (
      <div className="text-center text-sm text-gray-500">
        No shared-ice history with {team.name}
      </div>
    );
  }

  const showFaceoffs = player.position === "C";
  const teamColors = getTeamColors(team.abbrev);

  const wMean = (fn: (m: MatchupPlayer) => number) => weightedMean(withHistory, fn);

  const avgRivalry = wMean((m) => m.rivalryScore);
  const totalToiSeconds = withHistory.reduce((s, m) => s + m.toiSharedSeconds, 0);

  const mineGoals = wMean((m) => m.stats.goals);
  const mineAssists = wMean((m) => m.stats.assists);
  const minePoints = wMean((m) => m.stats.points);
  const mineShots = wMean((m) => m.stats.individualShots);
  const mineHits = wMean((m) => m.stats.hits);
  const mineBlocks = wMean((m) => m.stats.blocks);
  const minePIM = wMean((m) => m.stats.penalties);
  const mineFO = wMean((m) => m.stats.faceoffWins);

  const oppGoals = wMean((m) => m.oppStats.goals);
  const oppAssists = wMean((m) => m.oppStats.assists);
  const oppPoints = wMean((m) => m.oppStats.points);
  const oppShots = wMean((m) => m.oppStats.individualShots);
  const oppHits = wMean((m) => m.oppStats.hits);
  const oppBlocks = wMean((m) => m.oppStats.blocks);
  const oppPIM = wMean((m) => m.oppStats.penalties);
  const oppFO = wMean((m) => m.oppStats.faceoffWins);

  const playerName = `${player.firstName[0]}. ${player.lastName}`;
  const teamLabel = team.abbrev;

  const radarCategories: RadarCategory[] = [
    { key: "goals", label: "Goals", mine: mineGoals, opp: oppGoals },
    { key: "assists", label: "Assists", mine: mineAssists, opp: oppAssists },
    { key: "shots", label: "Shots", mine: mineShots, opp: oppShots },
    { key: "hits", label: "Hits", mine: mineHits, opp: oppHits },
    { key: "blocks", label: "Blocks", mine: mineBlocks, opp: oppBlocks },
    { key: "penalties", label: "PIM", mine: minePIM, opp: oppPIM, higherIsBetter: false },
  ];
  if (showFaceoffs) {
    radarCategories.push({ key: "fo", label: "FO Wins", mine: mineFO, opp: oppFO });
  }
  const hasRadarData = radarCategories.some((c) => c.mine > 0 || c.opp > 0);

  return (
    <div
      className="rounded-xl border bg-gray-800/40 px-4 py-4"
      style={{ borderColor: teamColors.primary + "60" }}
    >
      <div className="flex items-center gap-3 mb-3">
        {team.logoUrl ? (
          <span className="flex items-center justify-center rounded" style={{ width: 44, height: 44, background: "rgba(255,255,255,0.10)" }}>
            <img src={team.logoUrl} alt={team.abbrev} className="object-contain" style={{ width: 36, height: 36 }} />
          </span>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold" style={{ color: getTeamDisplayColor(team.abbrev) }}>
            {team.name}
          </div>
          <div className="text-[10px] text-gray-500">
            {withHistory.length} {withHistory.length === 1 ? "rival" : "rivals"} · TOI-weighted averages
          </div>
        </div>
        {standings && (
          <div className="text-right text-[10px] text-gray-400">
            <div><span className="font-bold text-white">{standings.points}</span> pts · {standings.wins}-{standings.losses}-{standings.otLosses}</div>
            <div className="text-gray-500">L10: <span className="text-gray-300">{standings.l10Record}</span></div>
          </div>
        )}
      </div>

      <ColumnHeaders playerName={playerName} teamLabel={teamLabel} />

      <div className="text-center py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Avg Rivalry Score </span>
        <span className={`font-mono text-sm font-bold ${avgRivalry > 0 ? "text-green-400" : avgRivalry < 0 ? "text-red-400" : "text-gray-400"}`}>
          {avgRivalry.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 pb-1.5 text-[10px] text-gray-500">
        <span>
          <span className="font-bold uppercase tracking-widest">Total TOI </span>
          <span className="font-mono text-gray-300">{formatSecondsToHMS(totalToiSeconds)}</span>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>
          <SectionLabel label="Scoring" />
          <StatRow label="Goals" mine={mineGoals} opp={oppGoals} />
          <StatRow label="Assists" mine={mineAssists} opp={oppAssists} />
          <StatRow label="Points" mine={minePoints} opp={oppPoints} />
          <StatRow label="Shots" mine={mineShots} opp={oppShots} />

          <SectionLabel label="Physical" />
          <StatRow label="Hits" mine={mineHits} opp={oppHits} />
          <StatRow label="Blocks" mine={mineBlocks} opp={oppBlocks} />
          <StatRow label="Penalties" mine={minePIM} opp={oppPIM} higherIsBetter={false} />

          {showFaceoffs && (
            <>
              <SectionLabel label="Faceoffs" />
              <StatRow label="FO Wins" mine={mineFO} opp={oppFO} />
            </>
          )}
        </div>
        {hasRadarData && (
          <MatchupRadarChart
            categories={radarCategories}
            playerName={playerName}
            opponentName={teamLabel}
          />
        )}
      </div>
    </div>
  );
}
