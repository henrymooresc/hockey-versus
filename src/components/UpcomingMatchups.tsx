"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, UpcomingGame, MatchupPlayer } from "@/types/versus";
import { PositionGroup } from "./MatchupTable";
import { PositionTabs } from "./PositionTabs";
import { UpcomingGamesSkeleton, MatchupTableSkeleton } from "./Skeleton";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function GameSelector({
  games,
  selected,
  onSelect,
}: {
  games: UpcomingGame[];
  selected: UpcomingGame | null;
  onSelect: (game: UpcomingGame) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto" style={{ paddingBottom: 16 }}>
      {games.map((game) => {
        const isSelected = selected?.gameId === game.gameId;
        return (
          <button
            key={game.gameId}
            onClick={() => onSelect(game)}
            style={{ padding: "14px 20px" }}
            className={`flex shrink-0 items-center gap-3 rounded-xl border transition-all duration-150 ${
              isSelected
                ? "border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-500/10"
                : "border-gray-700/60 bg-gray-800/60 hover:bg-gray-800 hover:border-gray-600"
            }`}
          >
            {game.opponentLogoUrl && (
              <img
                src={game.opponentLogoUrl}
                alt={game.opponentAbbrev}
                className="h-8 w-8 object-contain"
              />
            )}
            <div className="text-left">
              <div className="text-sm font-semibold text-white">
                {game.isHome ? "vs" : "@"} {game.opponentAbbrev}
              </div>
              <div className="text-xs text-gray-500">{formatDate(game.gameDate)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function UpcomingMatchups({ player }: { player: PlayerSearchResult }) {
  const [games, setGames] = useState<UpcomingGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<UpcomingGame | null>(null);
  const [matchups, setMatchups] = useState<MatchupPlayer[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingMatchups, setLoadingMatchups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"skaters" | "goalies">("skaters");

  useEffect(() => {
    setLoadingGames(true);
    setError(null);
    setGames([]);
    setSelectedGame(null);
    setMatchups([]);

    fetch(`/api/players/${player.id}/upcoming`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch schedule");
        return data;
      })
      .then((data) => {
        setGames(data.upcoming);
        if (data.upcoming.length > 0) {
          setSelectedGame(data.upcoming[0]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingGames(false));
  }, [player.id]);

  useEffect(() => {
    if (!selectedGame) return;

    setLoadingMatchups(true);
    setActiveTab("skaters");
    fetch(`/api/players/${player.id}/matchup?teamId=${selectedGame.opponentTeamId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch matchups");
        return data;
      })
      .then((data) => setMatchups(data.matchups))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMatchups(false));
  }, [player.id, selectedGame?.opponentTeamId]);

  if (loadingGames) {
    return <UpcomingGamesSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm">
        No upcoming games found
      </div>
    );
  }

  const skaters = matchups.filter(
    (m) => m.position === "C" || m.position === "L" || m.position === "R" || m.position === "D"
  );
  const goalies = matchups.filter((m) => m.position === "G");
  const unknown = matchups.filter(
    (m) => !["C", "L", "R", "D", "G"].includes(m.position ?? "")
  );
  const allSkaters = [...skaters, ...unknown];

  const withHistory = matchups.filter((m) => m.gamesShared > 0);
  const playerName = `${player.firstName[0]}. ${player.lastName}`;

  return (
    <div>
      <GameSelector
        games={games}
        selected={selectedGame}
        onSelect={setSelectedGame}
      />

      {matchups.length > 0 ? (
        <div style={{ marginTop: 28 }} className={`transition-opacity duration-200 ${loadingMatchups ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
            <div className="text-xs text-gray-600">
              {withHistory.length} of {matchups.length} players with shared history
            </div>
            <PositionTabs
              active={activeTab}
              onChange={setActiveTab}
              skaterCount={allSkaters.length}
              goalieCount={goalies.length}
            />
          </div>

          {activeTab === "skaters" ? (
            <PositionGroup
              label="Skaters"
              matchups={allSkaters}
              collapsible
              mode={player.position === "C" ? "center" : "skater"}
              playerPosition={player.position}
              playerName={playerName}
              playerId={player.id}
            />
          ) : (
            <PositionGroup
              label="Goalies"
              matchups={goalies}
              mode="goalie"
              playerPosition={player.position}
              playerName={playerName}
              playerId={player.id}
            />
          )}
        </div>
      ) : loadingMatchups ? (
        <div className="mt-6">
          <MatchupTableSkeleton rows={6} />
        </div>
      ) : (
        <div className="mt-6 text-center text-sm text-gray-500">
          No roster data available
        </div>
      )}
    </div>
  );
}
