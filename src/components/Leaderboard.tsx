"use client";

import { useState, useEffect, useMemo } from "react";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import type { MatchupPlayer } from "@/types/versus";
import { Skeleton } from "./Skeleton";
import { SkaterExpandedDetail, GoalieExpandedDetail } from "./ExpandedDetail";
import { SmallSampleMark } from "./SmallSampleMark";
import { useStandings } from "@/hooks/useStandings";
import { useFetchedData } from "@/hooks/useFetchedData";
import { useKeyedState } from "@/hooks/useKeyedState";
import { RemoteImage } from "./RemoteImage";

interface SeasonMeta { id: string; startDate: string | null; endDate: string | null; }

function PlayerSide({ player, align }: { player: LeaderboardEntry["playerA"]; align: "left" | "right" }) {
  const colors = getTeamColors(player.teamAbbrev);
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {player.headshotUrl ? (
        <RemoteImage
          src={player.headshotUrl}
          alt=""
          width={36}
          height={36}
          className="rounded-full object-cover shrink-0"
          style={{ border: `2px solid ${colors.primary}80`, width: 36, height: 36 }}
        />
      ) : (
        <div className="rounded-full bg-gray-700 shrink-0" style={{ width: 36, height: 36 }} />
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-100 truncate">
          {player.firstName} {player.lastName}
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] text-gray-500 ${align === "right" ? "justify-end" : ""}`}>
          {player.teamLogoUrl && (
            <RemoteImage src={player.teamLogoUrl} alt="" width={12} height={12} className="object-contain" />
          )}
          <span style={{ color: getTeamDisplayColor(player.teamAbbrev) }} className="font-semibold">
            {player.teamAbbrev ?? "—"}
          </span>
          <span className="text-gray-600">·</span>
          <span>{player.position ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Left-to-right display order for a pair.
 *
 * With a goalie in the pair the skater goes first, because the expanded card
 * reads as shooter against goalie. The row header and the card must call this
 * same helper, or the card shows each player's stats under the other name.
 */
function orderPair(entry: LeaderboardEntry) {
  const aIsGoalie = entry.playerA.position === "G";
  const bIsGoalie = entry.playerB.position === "G";
  if (aIsGoalie && !bIsGoalie) {
    return { left: entry.playerB, right: entry.playerA };
  }
  return { left: entry.playerA, right: entry.playerB };
}

function LeaderboardRow({
  entry,
  rank,
  expanded,
  onToggle,
  seasonsParam,
  gameTypeParam,
}: {
  entry: LeaderboardEntry;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  seasonsParam: string | null;
  gameTypeParam: string;
}) {
  const { left, right } = orderPair(entry);
  const teamColorsA = getTeamColors(left.teamAbbrev);
  // A season id here means the board is scoped to one season, where two teams
  // meet at most a handful of times. Every pair is a short history, so the mark
  // would sit on nearly every row and say nothing.
  const isSingleSeason = seasonsParam !== null;
  return (
    <div
      className={`rounded-lg border transition-colors ${
        expanded ? "bg-gray-800/80" : "border-gray-700/40 bg-gray-800/40 hover:bg-gray-800"
      }`}
      style={expanded ? { borderColor: teamColorsA.primary + "60" } : undefined}
    >
      <div
        className="grid items-center gap-3 cursor-pointer"
        style={{ gridTemplateColumns: "36px 1fr 80px 1fr 70px 60px 80px", padding: "10px 14px" }}
        onClick={onToggle}
      >
        <div className="text-center font-mono text-sm font-bold text-gray-500">{rank}</div>
        <PlayerSide player={left} align="right" />
        <div className="text-center text-[10px] uppercase tracking-widest text-gray-600">vs</div>
        <PlayerSide player={right} align="left" />
        <div className="text-right font-mono text-sm font-bold text-amber-400">
          {entry.rivalryScore.toFixed(2)}
          {!isSingleSeason && <SmallSampleMark gamesShared={entry.gamesShared} />}
        </div>
        <div className="text-right font-mono text-xs text-gray-400">{entry.gamesShared}</div>
        <div className="text-right font-mono text-xs text-gray-400">{formatSecondsToHMS(entry.toiSharedSeconds)}</div>
      </div>
      {expanded && (
        <div className="border-t border-gray-700/50 mx-2 mb-1 mt-0">
          <ExpandedPair entry={entry} seasonsParam={seasonsParam} gameTypeParam={gameTypeParam} />
        </div>
      )}
    </div>
  );
}

function ExpandedPair({
  entry,
  seasonsParam,
  gameTypeParam,
}: {
  entry: LeaderboardEntry;
  seasonsParam: string | null;
  gameTypeParam: string;
}) {
  const standings = useStandings();

  // Same order the row header shows, so a player's stats stay under their name.
  const { left: requesting, right: opponent } = orderPair(entry);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      opponentId: String(opponent.id),
      gameType: gameTypeParam,
    });
    if (seasonsParam) params.set("seasons", seasonsParam);
    return `/api/players/${requesting.id}/rivals?${params}`;
  }, [requesting.id, opponent.id, seasonsParam, gameTypeParam]);

  const { data, error: fetchError } = useFetchedData<{
    skaterRivals?: MatchupPlayer[];
    goalieRivals?: MatchupPlayer[];
  }>(url);

  const matchup = useMemo(() => {
    if (!data) return null;
    const all = [...(data.skaterRivals ?? []), ...(data.goalieRivals ?? [])];
    return all.find((m) => m.playerId === opponent.id) ?? null;
  }, [data, opponent.id]);

  // The request can succeed and still hold no row for this pair.
  const error = fetchError ?? (data && !matchup ? "No matchup data" : null);

  if (error) {
    return <div className="px-4 py-3 text-center text-sm text-red-400">{error}</div>;
  }
  if (!matchup) {
    return (
      <div className="px-4 py-4 text-center">
        <div className="inline-block h-3 w-3 animate-spin rounded-full border border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  const opponentIsGoalie = opponent.position === "G";
  const requestingIsGoalie = requesting.position === "G";

  // Same rule as the row above: a single-season board makes the mark uniform
  // and therefore meaningless.
  const showSmallSampleMark = seasonsParam === null;

  if (opponentIsGoalie || requestingIsGoalie) {
    return (
      <GoalieExpandedDetail
        matchup={matchup}
        playerPosition={requesting.position}
        player={requesting}
        playerId={requesting.id}
        standings={standings}
        showSmallSampleMark={showSmallSampleMark}
      />
    );
  }
  return (
    <SkaterExpandedDetail
      matchup={matchup}
      showFaceoffs={requesting.position === "C"}
      player={requesting}
      playerId={requesting.id}
      standings={standings}
      showSmallSampleMark={showSmallSampleMark}
    />
  );
}

function HeaderRow() {
  return (
    <div
      className="grid items-center gap-3 px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500"
      style={{ gridTemplateColumns: "36px 1fr 80px 1fr 70px 60px 80px" }}
    >
      <div className="text-center">#</div>
      <div />
      <div />
      <div />
      <div className="text-right">RIV</div>
      <div className="text-right">GP</div>
      <div className="text-right">TOI</div>
    </div>
  );
}

type SeasonFilter = "current" | "all";
type GameTypeFilter = "regular" | "playoffs" | "both";
type PairKind = "skater" | "goalie";

export function Leaderboard() {
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>("regular");
  const [pairKind, setPairKind] = useState<PairKind>("skater");
  const [allSeasons, setAllSeasons] = useState<SeasonMeta[]>([]);

  useEffect(() => {
    fetch("/api/seasons").then((r) => r.json()).then((d) => setAllSeasons(d.seasons ?? [])).catch(() => {});
  }, []);

  const seasonsParam =
    seasonFilter === "current" && allSeasons.length > 0 ? allSeasons[0].id : null;

  // Null until the season list arrives in "current" mode, so the first request
  // never goes out unfiltered.
  const url = useMemo(() => {
    if (seasonFilter === "current" && allSeasons.length === 0) return null;
    const params = new URLSearchParams({ limit: "50" });
    if (seasonFilter === "current") params.set("season", allSeasons[0].id);
    params.set("gameType", gameTypeFilter);
    params.set("kind", pairKind);
    return `/api/leaderboard?${params}`;
  }, [seasonFilter, gameTypeFilter, pairKind, allSeasons]);

  const { data, error } = useFetchedData<{ leaderboard: LeaderboardEntry[] }>(url);
  const entries = data?.leaderboard ?? null;

  // The open row belongs to one board, so a filter change closes it.
  const [expandedKey, setExpandedKey] = useKeyedState<string | null>(url ?? "", null);

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/60 p-1">
          {([
            { value: "skater", label: "Skater Rivalries" },
            { value: "goalie", label: "Shooter vs Goalie" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPairKind(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                pairKind === value ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/60 p-1">
          <button
            onClick={() => setSeasonFilter("current")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              seasonFilter === "current" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Current Season
          </button>
          <button
            onClick={() => setSeasonFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              seasonFilter === "all" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Last 10 Seasons
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/60 p-1">
          {([
            { value: "regular", label: "Regular" },
            { value: "playoffs", label: "Playoffs" },
            { value: "both", label: "Both" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setGameTypeFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                gameTypeFilter === value
                  ? "bg-amber-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">{error}</div>
      ) : entries === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton width={200} height={10} className="ml-3 mb-1" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={56} rounded="lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center text-gray-500">No data available</div>
      ) : (
        <>
          <HeaderRow />
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => {
              const key = `${entry.playerA.id}-${entry.playerB.id}`;
              return (
                <LeaderboardRow
                  key={key}
                  entry={entry}
                  rank={i + 1}
                  expanded={expandedKey === key}
                  onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
                  seasonsParam={seasonsParam}
                  gameTypeParam={gameTypeFilter}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
