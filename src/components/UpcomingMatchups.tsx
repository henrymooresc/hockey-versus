"use client";

import { useState, useEffect, useMemo } from "react";
import type { PlayerSearchResult, UpcomingGame, MatchupPlayer } from "@/types/versus";
import { PositionGroup } from "./MatchupTable";
import { PositionTabs } from "./PositionTabs";
import {
  ToggleGroup,
  SEASON_OPTIONS,
  GAME_TYPE_OPTIONS,
  type SeasonFilter,
  type GameTypeFilter,
} from "./ToggleGroup";
import { UpcomingGamesSkeleton, MatchupTableSkeleton } from "./Skeleton";
import { useFetchedData } from "@/hooks/useFetchedData";
import { useKeyedState } from "@/hooks/useKeyedState";
import { RemoteImage } from "./RemoteImage";

interface SeasonMeta {
  id: string;
  startDate: string | null;
  endDate: string | null;
}

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
              <RemoteImage
                src={game.opponentLogoUrl}
                alt={game.opponentAbbrev}
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
            )}
            <div className="text-left">
              <div className="text-base font-semibold text-gray-100">
                {game.isHome ? "vs" : "@"} {game.opponentAbbrev}
              </div>
              <div className="text-sm text-gray-500">{formatDate(game.gameDate)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function UpcomingMatchups({ player }: { player: PlayerSearchResult }) {
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("current");
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>("regular");
  const [allSeasons, setAllSeasons] = useState<SeasonMeta[]>([]);

  useEffect(() => {
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((data) => setAllSeasons(data.seasons ?? []))
      .catch(() => {});
  }, []);

  const seasonIds: string[] | null = useMemo(() => {
    if (seasonFilter === "all" || allSeasons.length === 0) return null;
    return [allSeasons[0].id];
  }, [seasonFilter, allSeasons]);

  const {
    data: schedule,
    error: scheduleError,
    loading: loadingGames,
  } = useFetchedData<{ upcoming: UpcomingGame[] }>(
    `/api/players/${player.id}/upcoming`
  );
  const games = useMemo(() => schedule?.upcoming ?? [], [schedule]);

  // The pick resets when the player changes, and falls back to the first game
  // so the panel is never empty on landing.
  const [pickedGameId, setPickedGameId] = useKeyedState<number | null>(
    String(player.id),
    null
  );
  const selectedGame =
    games.find((g) => g.gameId === pickedGameId) ?? games[0] ?? null;

  // Null holds the request back until a game is chosen, and until the seasons
  // list arrives in "current" mode, so the first fetch does not race an
  // unfiltered one.
  const matchupUrl = useMemo(() => {
    if (!selectedGame) return null;
    if (seasonFilter === "current" && allSeasons.length === 0) return null;
    const params = new URLSearchParams({
      teamId: String(selectedGame.opponentTeamId),
      gameType: gameTypeFilter,
    });
    if (seasonIds) params.set("seasons", seasonIds.join(","));
    return `/api/players/${player.id}/matchup?${params}`;
  }, [
    player.id,
    selectedGame,
    gameTypeFilter,
    seasonIds,
    seasonFilter,
    allSeasons.length,
  ]);

  // Same reason as the rivals panel: the tab counts come from this data, so
  // clearing it on a filter change collapsed them and reflowed the row.
  const {
    data: matchupData,
    error: matchupError,
    refreshing: loadingMatchups,
  } = useFetchedData<{ matchups: MatchupPlayer[] }>(matchupUrl, {
    keepPreviousData: true,
  });
  const matchups = useMemo(() => matchupData?.matchups ?? [], [matchupData]);

  // The open tab belongs to one matchup request, so a new one returns to
  // skaters.
  const [activeTab, setActiveTab] = useKeyedState<"skaters" | "goalies">(
    matchupUrl ?? "",
    "skaters"
  );

  const error = scheduleError ?? matchupError;

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
      <div className="text-center text-gray-500 text-base">
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

  return (
    <div>
      <GameSelector
        games={games}
        selected={selectedGame}
        onSelect={(game) => setPickedGameId(game.gameId)}
      />

      {matchups.length > 0 ? (
        <div style={{ marginTop: 28 }} className={`transition-opacity duration-200 ${loadingMatchups ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 20 }}>
            <div className="text-sm text-gray-600">
              {withHistory.length} of {matchups.length} players with shared history
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PositionTabs
                active={activeTab}
                onChange={setActiveTab}
                skaterCount={allSkaters.length}
                goalieCount={goalies.length}
              />
              <ToggleGroup
                options={SEASON_OPTIONS}
                active={seasonFilter}
                onChange={setSeasonFilter}
                label="Season range"
              />
              <ToggleGroup
                options={GAME_TYPE_OPTIONS}
                active={gameTypeFilter}
                onChange={setGameTypeFilter}
                label="Game type"
              />
            </div>
          </div>

          {activeTab === "skaters" ? (
            <PositionGroup
              label="Skaters"
              matchups={allSkaters}
              collapsible
              mode={player.position === "C" ? "center" : "skater"}
              playerPosition={player.position}
              player={player}
              playerId={player.id}
              showSmallSampleMark={seasonFilter === "all"}
            />
          ) : (
            <PositionGroup
              label="Goalies"
              matchups={goalies}
              mode="goalie"
              playerPosition={player.position}
              player={player}
              playerId={player.id}
              showSmallSampleMark={seasonFilter === "all"}
            />
          )}
        </div>
      ) : loadingMatchups ? (
        <div className="mt-6">
          <MatchupTableSkeleton rows={6} />
        </div>
      ) : (
        <div className="mt-6 text-center text-base text-gray-500">
          No roster data available
        </div>
      )}
    </div>
  );
}
