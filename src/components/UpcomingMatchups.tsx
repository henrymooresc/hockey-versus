"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, UpcomingGame, MatchupPlayer } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";

type SortKey = "points" | "shots" | "hits" | "pim" | "toi";


function getSortValue(m: MatchupPlayer, key: SortKey): number {
  switch (key) {
    case "points": return m.stats.points - m.oppStats.points;
    case "shots": return m.stats.shotsFor - m.oppStats.shotsFor;
    case "hits": return m.stats.hits - m.oppStats.hits;
    case "pim": return m.stats.penalties - m.oppStats.penalties;
    case "toi": return m.toiSharedSeconds;
  }
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

const ROW_GRID = "30px 1fr 40px 40px 40px 40px";

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
      <span className="text-gray-700">–</span>
      <span className="text-gray-500" style={{ width: 16, textAlign: "left", display: "inline-block" }}>
        {opp}
      </span>
    </div>
  );
}

const HEADER_COLUMNS: { label: string; key: SortKey }[] = [
  { label: "PTS", key: "points" },
  { label: "SH", key: "shots" },
  { label: "HT", key: "hits" },
  { label: "PIM", key: "pim" },
];

function StatHeader({
  sortKey,
  sortDir,
  onSort,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: ROW_GRID, padding: "0 10px", gap: 6, marginBottom: 6 }}
    >
      <div />
      <div />
      {HEADER_COLUMNS.map((col) => {
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
  playerName,
}: {
  matchup: MatchupPlayer;
  playerName: string;
}) {
  const hasHistory = matchup.gamesShared > 0;

  return (
    <div
      className="grid items-center rounded-lg border border-gray-700/50 bg-gray-800/60 py-3 transition-colors duration-150 hover:bg-gray-800"
      style={{ gridTemplateColumns: ROW_GRID, padding: "10px 10px", gap: 6 }}
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
        <>
          <StatValue mine={matchup.stats.points} opp={matchup.oppStats.points} />
          <StatValue mine={matchup.stats.shotsFor} opp={matchup.oppStats.shotsFor} />
          <StatValue mine={matchup.stats.hits} opp={matchup.oppStats.hits} />
          <StatValue mine={matchup.stats.penalties} opp={matchup.oppStats.penalties} />
        </>
      ) : (
        <>
          <div /><div /><div /><div />
        </>
      )}
    </div>
  );
}

const GROUP_DEFAULT_VISIBLE = 6;

function PositionGroup({
  label,
  matchups,
  playerName,
  collapsible = false,
}: {
  label: string;
  matchups: MatchupPlayer[];
  playerName: string;
  collapsible?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (matchups.length === 0) return null;

  const sorted = [...matchups].sort((a, b) => {
    if (a.gamesShared > 0 && b.gamesShared === 0) return -1;
    if (a.gamesShared === 0 && b.gamesShared > 0) return 1;
    if (a.gamesShared === 0 && b.gamesShared === 0) return 0;
    const diff = getSortValue(b, sortKey) - getSortValue(a, sortKey);
    return sortDir === "desc" ? diff : -diff;
  });

  const visible = collapsible && !showAll ? sorted.slice(0, GROUP_DEFAULT_VISIBLE) : sorted;
  const hasMore = collapsible && matchups.length > GROUP_DEFAULT_VISIBLE;

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
      <StatHeader sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      <div className="flex flex-col gap-3">
        {visible.map((m) => (
          <MatchupRow key={m.playerId} matchup={m} playerName={playerName} />
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
            : `Show ${matchups.length - GROUP_DEFAULT_VISIBLE} more`}
        </button>
      )}
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
            <PositionGroup label="Forwards" matchups={forwards} playerName={player.lastName} collapsible />
            <PositionGroup label="Defense" matchups={defensemen} playerName={player.lastName} collapsible />
            <div>
              <PositionGroup label="Goalies" matchups={goalies} playerName={player.lastName} />
              {unknown.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <PositionGroup label="Other" matchups={unknown} playerName={player.lastName} />
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
