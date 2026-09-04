"use client";

import { useMemo, useState } from "react";
import type { TargetingEntry } from "@/app/api/targeting/route";
import type { BioPlayer } from "@/types/versus";
import { useFetchedData } from "@/hooks/useFetchedData";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import { ToggleGroup, GAME_TYPE_OPTIONS, type GameTypeFilter } from "./ToggleGroup";
import { RemoteImage } from "./RemoteImage";
import { Skeleton } from "./Skeleton";

const GRID = "44px minmax(0,1fr) 84px minmax(0,1fr) 76px 56px 84px";

function Side({
  player, lift, hits, align,
}: {
  player: BioPlayer; lift: number; hits: number; align: "left" | "right";
}) {
  const colors = getTeamColors(player.teamAbbrev);
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {player.headshotUrl ? (
        <RemoteImage
          src={player.headshotUrl}
          alt=""
          width={36}
          height={36}
          className="shrink-0 rounded-full object-cover"
          style={{ border: `2px solid ${colors.primary}80`, width: 36, height: 36 }}
        />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-full bg-gray-700" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-gray-100">
          {player.firstName} {player.lastName}
        </div>
        <div
          className={`flex items-center gap-1.5 text-xs text-gray-500 ${
            align === "right" ? "justify-end" : ""
          }`}
        >
          <span className="font-semibold" style={{ color: getTeamDisplayColor(player.teamAbbrev) }}>
            {player.teamAbbrev ?? "—"}
          </span>
          <span>{player.position ?? "—"}</span>
          <span className="tabular-nums">{hits} hits &middot; {lift.toFixed(2)}×</span>
        </div>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: TargetingEntry }) {
  return (
    <div
      className="grid items-center gap-2 rounded-lg border border-gray-700/40 bg-gray-800/40 px-3 py-2"
      style={{ gridTemplateColumns: GRID }}
    >
      <span className="text-center text-sm font-bold tabular-nums text-gray-500">
        {entry.rank}
      </span>
      <Side player={entry.playerA} lift={entry.liftA} hits={entry.hitsAOnB} align="left" />
      <span className="text-center text-lg font-bold tabular-nums text-amber-400">
        {entry.targetingScore.toFixed(2)}×
      </span>
      <Side player={entry.playerB} lift={entry.liftB} hits={entry.hitsBOnA} align="right" />
      <span className="text-right text-sm tabular-nums text-gray-400">
        {entry.hitsAOnB + entry.hitsBOnA}
      </span>
      <span className="text-right text-sm tabular-nums text-gray-400">{entry.gamesShared}</span>
      <span className="text-right text-sm tabular-nums text-gray-400">
        {formatSecondsToHMS(entry.toiSharedSeconds)}
      </span>
    </div>
  );
}

export function TargetingBoard({
  playerId,
  limit = 25,
}: {
  playerId?: number;
  limit?: number;
}) {
  const [gameType, setGameType] = useState<GameTypeFilter>("regular");

  const url = useMemo(() => {
    const p = new URLSearchParams({ season: "ALL", gameType, limit: String(limit) });
    if (playerId !== undefined) p.set("playerId", String(playerId));
    return `/api/targeting?${p}`;
  }, [gameType, limit, playerId]);

  const { data, loading } = useFetchedData<{ entries?: TargetingEntry[] }>(url);
  const entries = useMemo(() => data?.entries ?? [], [data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-100">Targeting</h2>
          <p className="max-w-2xl text-sm text-gray-500">
            Pairs who hit each other far more than they hit anyone else. The score is
            the <em>lower</em> of the two players&rsquo; rates, so both have to be
            seeking the other out.
          </p>
        </div>
        <ToggleGroup
          options={GAME_TYPE_OPTIONS}
          active={gameType}
          onChange={setGameType}
          label="Game type"
        />
      </div>

      <div
        className="grid items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
        style={{ gridTemplateColumns: GRID }}
      >
        <span className="text-center">#</span>
        <span>Player</span>
        <span className="text-center">Score</span>
        <span className="text-right">Player</span>
        <span className="text-right">Hits</span>
        <span className="text-right">GP</span>
        <span className="text-right">Shared TOI</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={56} rounded="lg" />)
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No pairs above the shared-ice threshold in this range.
          </p>
        ) : (
          entries.map((e) => (
            <Row key={`${e.playerA.lastName}-${e.playerB.lastName}-${e.rank}`} entry={e} />
          ))
        )}
      </div>

      <p className="text-xs text-gray-600">
        Measured against each player&rsquo;s own hit rate across every opponent, not a
        league average, so a heavy hitter has to exceed his own standard to appear.
      </p>
    </section>
  );
}
