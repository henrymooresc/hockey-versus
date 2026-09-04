"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RosterPlayer, TeamRosterResponse } from "@/app/api/teams/[id]/roster/route";
import { useFetchedData } from "@/hooks/useFetchedData";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamDisplayColor } from "@/lib/team-colors";
import { ToggleGroup, GAME_TYPE_OPTIONS, type GameTypeFilter } from "./ToggleGroup";
import { RemoteImage } from "./RemoteImage";
import { Skeleton } from "./Skeleton";

const SCOPE_OPTIONS = [
  { value: "current", label: "This Season" },
  { value: "all", label: "With This Team" },
] as const;

type ScopeFilter = (typeof SCOPE_OPTIONS)[number]["value"];

/**
 * Rate stats for one player, per 60 minutes of ice time.
 *
 * Per 60 rather than per game, which is what the review asked for. Per game
 * conflates production with opportunity, because it divides by appearances
 * rather than by the time actually spent on the ice.
 *
 * Edmonton, 2025-26: Dach threw 219 hits in 700 minutes and Podkolzin 242 in
 * 1,259. Per game that is 3.59 against 2.95, a 22% gap. Per 60 it is 18.77
 * against 11.52, a 63% gap — because Podkolzin played nearly twice the
 * minutes to get there. Per game understates how much more physical Dach is
 * in the time he gets, and on a fourth-liner against a top-six winger that
 * difference is the whole story.
 *
 * This is the standard rate in hockey analytics for exactly that reason, and
 * the audience here is knowledgeable fans.
 *
 * Expect unfamiliar magnitudes: points per 60 runs about 2 to 3 for a star,
 * not the ~1.2 a box score shows.
 *
 * The `|| 1` guards a division by zero, not a small sample. A player with very
 * few minutes still gets a wild rate off a tiny denominator; nothing here
 * regresses that the way the rivalry score does.
 */
function rates(p: RosterPlayer) {
  const hours = p.toiSeconds > 0 ? p.toiSeconds / 3600 : 1;
  return {
    points: p.points / hours,
    hits: p.hits / hours,
    blocks: p.blocks / hours,
    shots: p.shots / hours,
  };
}

type SortKey = "toi" | "gp" | "points" | "hits" | "blocks" | "shots" | "pim";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "gp", label: "GP" },
  { key: "toi", label: "TOI" },
  { key: "points", label: "P/60" },
  { key: "shots", label: "S/60" },
  { key: "hits", label: "H/60" },
  { key: "blocks", label: "B/60" },
  { key: "pim", label: "PIM" },
];

const GRID = "minmax(0, 1fr) 52px 84px 68px 68px 68px 68px 60px";

function sortValue(p: RosterPlayer, key: SortKey): number {
  const r = rates(p);
  switch (key) {
    case "toi": return p.toiSeconds;
    case "gp": return p.gamesPlayed;
    case "points": return r.points;
    case "hits": return r.hits;
    case "blocks": return r.blocks;
    case "shots": return r.shots;
    case "pim": return p.penaltyMinutes;
  }
}

function RosterRow({ player, abbrev }: { player: RosterPlayer; abbrev: string }) {
  const r = rates(player);
  const isGoalie = player.position === "G";
  return (
    <Link
      href={`/?player=${player.id}`}
      className="grid items-center gap-2 rounded-lg border border-gray-700/40 bg-gray-800/40 px-3 py-2 text-sm transition-colors hover:bg-gray-700/50"
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {player.headshotUrl ? (
          <RemoteImage
            src={player.headshotUrl}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-[30px] w-[30px] shrink-0 rounded-full bg-gray-700" />
        )}
        <span className="truncate font-semibold text-gray-100">
          {player.firstName} {player.lastName}
        </span>
        <span
          className="shrink-0 text-xs font-bold"
          style={{ color: getTeamDisplayColor(abbrev) }}
        >
          {player.position ?? "—"}
        </span>
      </div>
      <span className="text-right tabular-nums text-gray-300">{player.gamesPlayed}</span>
      <span className="text-right tabular-nums text-gray-300">
        {formatSecondsToHMS(player.toiSeconds)}
      </span>
      {/* A goalie's skater rates are all zero and mean nothing, so they read as
          dashes rather than a column of 0.00 that invites comparison. */}
      <span className="text-right tabular-nums text-gray-300">{isGoalie ? "—" : r.points.toFixed(2)}</span>
      <span className="text-right tabular-nums text-gray-300">{isGoalie ? "—" : r.shots.toFixed(2)}</span>
      <span className="text-right tabular-nums text-gray-300">{isGoalie ? "—" : r.hits.toFixed(2)}</span>
      <span className="text-right tabular-nums text-gray-300">{isGoalie ? "—" : r.blocks.toFixed(2)}</span>
      <span className="text-right tabular-nums text-gray-300">{player.penaltyMinutes}</span>
    </Link>
  );
}

export function TeamRoster({ teamId }: { teamId: number }) {
  const [scope, setScope] = useState<ScopeFilter>("current");
  const [gameType, setGameType] = useState<GameTypeFilter>("regular");
  const [sortKey, setSortKey] = useState<SortKey>("toi");

  const url = `/api/teams/${teamId}/roster?season=${scope}&gameType=${gameType}`;
  const { data, loading } = useFetchedData<TeamRosterResponse>(url);

  const players = useMemo(() => {
    const list = data?.players ?? [];
    return [...list].sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));
  }, [data, sortKey]);

  const team = data?.team;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {team?.logoUrl && (
            <span
              className="flex items-center justify-center rounded"
              style={{ width: 48, height: 48, background: "rgba(255,255,255,0.12)" }}
            >
              <RemoteImage src={team.logoUrl} alt="" width={38} height={38} className="object-contain" />
            </span>
          )}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-100">
              {team?.name ?? " "}
            </h1>
            {/* "with games" is not padding. The roster is who is on the club
                now, but a player only appears once he has actually played for
                it in the selected range, so this count sits below the squad
                size on the teams page and the difference needs explaining. */}
            <p className="text-sm text-gray-500">
              {loading
                ? "Loading roster…"
                : `${players.length} players with games ${
                    scope === "current" ? "this season" : "for this team"
                  }`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup options={SCOPE_OPTIONS} active={scope} onChange={setScope} label="Season scope" />
          <ToggleGroup options={GAME_TYPE_OPTIONS} active={gameType} onChange={setGameType} label="Game type" />
        </div>
      </div>

      <div
        className="grid items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
        style={{ gridTemplateColumns: GRID }}
      >
        <span>Player</span>
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            onClick={() => setSortKey(c.key)}
            className={`text-right transition-colors hover:text-gray-300 ${
              sortKey === c.key ? "text-blue-400" : ""
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} height={46} rounded="lg" />)
        ) : players.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            No recorded games for this team in the selected range.
          </p>
        ) : (
          players.map((p) => (
            <RosterRow key={p.id} player={p} abbrev={team?.abbrev ?? ""} />
          ))
        )}
      </div>
    </div>
  );
}
