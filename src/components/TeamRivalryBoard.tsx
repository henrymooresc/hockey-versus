"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TeamRivalryEntry, TeamRivalryTeam } from "@/app/api/team-rivalries/route";
import { useFetchedData } from "@/hooks/useFetchedData";
import { getTeamDisplayColor } from "@/lib/team-colors";
import { ToggleGroup, GAME_TYPE_OPTIONS, type GameTypeFilter } from "./ToggleGroup";
import { RemoteImage } from "./RemoteImage";
import { Skeleton } from "./Skeleton";

const GRID = "44px minmax(0,1fr) minmax(0,1fr) 72px 60px 64px 64px 64px";

function TeamSide({ team, align }: { team: TeamRivalryTeam; align: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {team.logoUrl ? (
        <span
          className="flex shrink-0 items-center justify-center rounded"
          style={{ width: 30, height: 30, background: "rgba(255,255,255,0.12)" }}
        >
          <RemoteImage src={team.logoUrl} alt="" width={24} height={24} className="object-contain" />
        </span>
      ) : (
        <div className="h-[30px] w-[30px] shrink-0 rounded bg-gray-700" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-gray-100">{team.name}</div>
        <div
          className="text-xs font-bold"
          style={{ color: getTeamDisplayColor(team.abbrev) }}
        >
          {team.abbrev}
        </div>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: TeamRivalryEntry }) {
  const perGame = (n: number) =>
    entry.gamesPlayed > 0 ? (n / entry.gamesPlayed).toFixed(1) : "—";
  return (
    <div
      className="grid items-center gap-2 rounded-lg border border-gray-700/40 bg-gray-800/40 px-3 py-2"
      style={{ gridTemplateColumns: GRID }}
    >
      <span className="text-center text-sm font-bold tabular-nums text-gray-500">
        {entry.rank}
      </span>
      <Link href={`/team/${entry.teamX.id}`} className="min-w-0 hover:opacity-80">
        <TeamSide team={entry.teamX} align="left" />
      </Link>
      <Link href={`/team/${entry.teamY.id}`} className="min-w-0 hover:opacity-80">
        <TeamSide team={entry.teamY} align="right" />
      </Link>
      <span className="text-right text-sm font-bold tabular-nums text-amber-400">
        {entry.rivalryScore.toFixed(2)}
      </span>
      <span className="text-right text-sm tabular-nums text-gray-400">{entry.gamesPlayed}</span>
      <span className="text-right text-sm tabular-nums text-gray-400">{perGame(entry.goals)}</span>
      <span className="text-right text-sm tabular-nums text-gray-400">{perGame(entry.hits)}</span>
      <span className="text-right text-sm tabular-nums text-gray-400">
        {perGame(entry.penaltyMinutes)}
      </span>
    </div>
  );
}

export function TeamRivalryBoard({
  teamId,
  limit = 25,
  title = "Team Rivalries",
  subtitle = "The most contested matchups in the league",
}: {
  teamId?: number;
  limit?: number;
  title?: string;
  subtitle?: string;
}) {
  const [gameType, setGameType] = useState<GameTypeFilter>("regular");

  const url = useMemo(() => {
    const p = new URLSearchParams({ season: "ALL", gameType, limit: String(limit) });
    if (teamId !== undefined) p.set("teamId", String(teamId));
    return `/api/team-rivalries?${p}`;
  }, [gameType, limit, teamId]);

  const { data, loading } = useFetchedData<{ entries?: TeamRivalryEntry[] }>(url);
  const entries = useMemo(() => data?.entries ?? [], [data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-100">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
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
        <span>Team</span>
        <span className="text-right">Team</span>
        <span className="text-right">Score</span>
        <span className="text-right">GP</span>
        <span className="text-right">G/G</span>
        <span className="text-right">H/G</span>
        <span className="text-right">PIM/G</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={50} rounded="lg" />)
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No matchups recorded in this range.
          </p>
        ) : (
          entries.map((e) => <Row key={`${e.teamX.id}-${e.teamY.id}`} entry={e} />)
        )}
      </div>

      {/* The rank is the matchup's place on the league board, so a filtered
          list skips numbers. Saying so stops it reading as a bug. */}
      {teamId !== undefined && entries.length > 0 && (
        <p className="text-xs text-gray-600">
          Ranked against every league matchup, so the numbers are not consecutive.
        </p>
      )}
    </section>
  );
}
