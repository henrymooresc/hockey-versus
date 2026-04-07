"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, UpcomingGame, MatchupPlayer } from "@/types/versus";
import { PositionGroup } from "./MatchupTable";

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
    return (
      <div className="text-center text-gray-500">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <p className="mt-2 text-sm">Loading schedule...</p>
      </div>
    );
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

  const forwards = matchups.filter(
    (m) => m.position === "C" || m.position === "L" || m.position === "R"
  );
  const defensemen = matchups.filter((m) => m.position === "D");
  const goalies = matchups.filter((m) => m.position === "G");
  const unknown = matchups.filter(
    (m) => !["C", "L", "R", "D", "G"].includes(m.position ?? "")
  );

  const withHistory = matchups.filter((m) => m.gamesShared > 0);

  return (
    <div>
      <GameSelector
        games={games}
        selected={selectedGame}
        onSelect={setSelectedGame}
      />

      {loadingMatchups ? (
        <div className="mt-6 text-center text-gray-500">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <p className="mt-2 text-sm">Loading matchup data...</p>
        </div>
      ) : matchups.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          <div className="text-xs text-gray-600" style={{ marginBottom: 20 }}>
            {withHistory.length} of {matchups.length} players with shared history
          </div>

          <div className="grid grid-cols-3 gap-8 items-start">
            <PositionGroup label="Forwards" matchups={forwards} collapsible mode={player.position === "C" ? "center" : "skater"} />
            <PositionGroup label="Defense" matchups={defensemen} collapsible />
            <div>
              <PositionGroup label="Goalies" matchups={goalies} mode="goalie" />
              {unknown.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <PositionGroup label="Other" matchups={unknown} />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center text-sm text-gray-500">
          No roster data available
        </div>
      )}
    </div>
  );
}
