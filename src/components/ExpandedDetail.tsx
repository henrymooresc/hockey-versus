"use client";

import { useState, useEffect } from "react";
import type { BioPlayer, MatchupPlayer, RivalGameHistory, StandingsEntry } from "@/types/versus";
import { PlayerBioCard } from "./PlayerBioCard";
import { RivalryTrendChart } from "./RivalryTrendChart";
import { MatchupRadarChart, type RadarCategory } from "./MatchupRadarChart";
import { TeamHistoryTimeline } from "./TeamHistoryTimeline";
import { ErrorBoundary } from "./ErrorBoundary";

export type PlayerPosition = string | null;

function savePct(shotsAgainst: number, goalsAgainst: number): string {
  if (shotsAgainst === 0) return "1.000";
  return ((shotsAgainst - goalsAgainst) / shotsAgainst).toFixed(3);
}

function foPct(wins: number, oppWins: number): string {
  const total = wins + oppWins;
  if (total === 0) return "\u2014";
  return ((wins / total) * 100).toFixed(0) + "%";
}

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

function LoadingSpinner() {
  return (
    <div className="mt-2 text-center">
      <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
    </div>
  );
}

function useRivalHistory(playerId: number, opponentId: number): RivalGameHistory[] | null {
  const [history, setHistory] = useState<RivalGameHistory[] | null>(null);
  useEffect(() => {
    fetch(`/api/players/${playerId}/rival-history?opponentId=${opponentId}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.games ?? []))
      .catch(() => setHistory([]));
  }, [playerId, opponentId]);
  return history;
}

function ColumnHeaders({ playerName, opponentName }: { playerName: string; opponentName: string }) {
  return (
    <div className="grid grid-cols-3 items-center pb-1 mb-1 border-b border-gray-700/50">
      <div className="text-right text-[10px] font-bold uppercase tracking-wider text-gray-500">{playerName}</div>
      <div />
      <div className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">{opponentName}</div>
    </div>
  );
}

export function SkaterExpandedDetail({
  matchup,
  showFaceoffs,
  player,
  playerId,
  standings,
}: {
  matchup: MatchupPlayer;
  showFaceoffs: boolean;
  player: BioPlayer;
  playerId: number;
  standings: Map<string, StandingsEntry>;
}) {
  const { stats, oppStats } = matchup;
  const history = useRivalHistory(playerId, matchup.playerId);
  const playerName = `${player.firstName[0]}. ${player.lastName}`;
  const oppShort = `${matchup.firstName[0]}. ${matchup.lastName}`;

  const radarCategories: RadarCategory[] = [
    { key: "goals", label: "Goals", mine: stats.goals, opp: oppStats.goals },
    { key: "assists", label: "Assists", mine: stats.assists, opp: oppStats.assists },
    { key: "shots", label: "Shots", mine: stats.individualShots, opp: oppStats.individualShots },
    { key: "hits", label: "Hits", mine: stats.hits, opp: oppStats.hits },
    { key: "blocks", label: "Blocks", mine: stats.blocks, opp: oppStats.blocks },
    { key: "penalties", label: "PIM", mine: stats.penalties, opp: oppStats.penalties, higherIsBetter: false },
  ];
  if (showFaceoffs) {
    radarCategories.push({ key: "fo", label: "FO Wins", mine: stats.faceoffWins, opp: oppStats.faceoffWins });
  }
  const hasRadarData = radarCategories.some((c) => c.mine > 0 || c.opp > 0);

  return (
    <div className="px-2 pb-3">
      <div className="mb-3">
        <PlayerBioCard
            player={player}
            opponent={matchup}
            rivalryScore={matchup.rivalryScore}
            gamesShared={matchup.gamesShared}
            toiSharedSeconds={matchup.toiSharedSeconds}
            standings={standings}
          />
      </div>

      <div className="pt-2 pb-1 text-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Stat Comparison</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>
          <ColumnHeaders playerName={playerName} opponentName={oppShort} />
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
        </div>

        {hasRadarData && (
          <div className="md:sticky md:top-2">
            <ErrorBoundary fallback={null}>
              <MatchupRadarChart
                categories={radarCategories}
                playerName={playerName}
                opponentName={oppShort}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {history && history.length > 0 && (
        <ErrorBoundary fallback={null}>
          <RivalryTrendChart history={history} />
        </ErrorBoundary>
      )}
      {history === null && <LoadingSpinner />}

      <ErrorBoundary fallback={null}>
        <TeamHistoryTimeline
          playerId={playerId}
          opponentId={matchup.playerId}
          playerLabel={playerName}
          opponentLabel={oppShort}
        />
      </ErrorBoundary>
    </div>
  );
}

export function GoalieExpandedDetail({
  matchup,
  playerPosition,
  player,
  playerId,
  standings,
}: {
  matchup: MatchupPlayer;
  playerPosition: PlayerPosition;
  player: BioPlayer;
  playerId: number;
  standings: Map<string, StandingsEntry>;
}) {
  const { stats, oppStats } = matchup;
  const isPlayerGoalie = playerPosition === "G";
  const history = useRivalHistory(playerId, matchup.playerId);
  const playerName = `${player.firstName[0]}. ${player.lastName}`;

  if (isPlayerGoalie) {
    const mySaves = stats.individualShots - stats.goals;
    const oppSaves = oppStats.individualShots - oppStats.goals;
    return (
      <div className="px-2 pb-3">
        <div className="mb-3">
          <PlayerBioCard
            player={player}
            opponent={matchup}
            rivalryScore={matchup.rivalryScore}
            gamesShared={matchup.gamesShared}
            toiSharedSeconds={matchup.toiSharedSeconds}
            standings={standings}
          />
        </div>

        <div className="pt-2 pb-1 text-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Stat Comparison</span>
        </div>
        <ColumnHeaders playerName={playerName} opponentName={`${matchup.firstName[0]}. ${matchup.lastName}`} />

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

        {history && history.length > 0 && (
        <ErrorBoundary fallback={null}>
          <RivalryTrendChart history={history} />
        </ErrorBoundary>
      )}
        {history === null && <LoadingSpinner />}

        <ErrorBoundary fallback={null}>
          <TeamHistoryTimeline
            playerId={playerId}
            opponentId={matchup.playerId}
            playerLabel={playerName}
            opponentLabel={`${matchup.firstName[0]}. ${matchup.lastName}`}
          />
        </ErrorBoundary>
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
        <PlayerBioCard
            player={player}
            opponent={matchup}
            rivalryScore={matchup.rivalryScore}
            gamesShared={matchup.gamesShared}
            toiSharedSeconds={matchup.toiSharedSeconds}
            standings={standings}
          />
      </div>

      <div className="pt-2 pb-2 text-center">
        <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Stat Comparison</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
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

      {history && history.length > 0 && (
        <ErrorBoundary fallback={null}>
          <RivalryTrendChart history={history} />
        </ErrorBoundary>
      )}
      {history === null && <LoadingSpinner />}

      <ErrorBoundary fallback={null}>
        <TeamHistoryTimeline
          playerId={playerId}
          opponentId={matchup.playerId}
          playerLabel={playerName}
          opponentLabel={`${matchup.firstName[0]}. ${matchup.lastName}`}
        />
      </ErrorBoundary>
    </div>
  );
}
