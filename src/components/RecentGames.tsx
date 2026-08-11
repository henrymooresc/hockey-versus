"use client";

import Link from "next/link";
import { getTeamDisplayColor } from "@/lib/team-colors";
import { useFetchedData } from "@/hooks/useFetchedData";
import {
  groupIntoSeries,
  roundName,
  type GameForSeries,
  type PlayoffSeries,
  type SeriesGame,
  type SeriesSide,
} from "@/lib/playoff-series";
import { Skeleton } from "./Skeleton";
import { RemoteImage } from "./RemoteImage";

function formatDate(s: string): string {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(s: string): string {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The score a given team put up in a game, whether they were home or away. */
function scoreFor(game: SeriesGame, abbrev: string | null): number | null {
  if (abbrev == null) return null;
  if (game.home.abbrev === abbrev) return game.home.score;
  if (game.away.abbrev === abbrev) return game.away.score;
  return null;
}

function TeamRow({ side, leading }: { side: SeriesSide; leading: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${leading ? "" : "opacity-65"}`}>
      {side.logoUrl ? (
        <RemoteImage src={side.logoUrl} alt="" width={32} height={32} className="object-contain shrink-0" />
      ) : (
        <div className="shrink-0 rounded bg-gray-700" style={{ width: 32, height: 32 }} />
      )}
      <span
        className="truncate text-sm font-bold"
        style={{ color: getTeamDisplayColor(side.abbrev) }}
      >
        {side.abbrev ?? "—"}
      </span>
      <span className="ml-auto font-mono text-xl font-extrabold tabular-nums text-gray-100">
        {side.wins}
      </span>
    </div>
  );
}

/**
 * One game in the series, as a compact chip.
 *
 * The score always reads in the same order as the two teams above it, so a
 * reader does not have to check who was at home. The winning number is bright
 * and the losing one is dim.
 */
function GameChip({ game, sides }: { game: SeriesGame; sides: [SeriesSide, SeriesSide] }) {
  const a = scoreFor(game, sides[0].abbrev);
  const b = scoreFor(game, sides[1].abbrev);
  const aWon = game.winnerAbbrev != null && game.winnerAbbrev === sides[0].abbrev;
  const bWon = game.winnerAbbrev != null && game.winnerAbbrev === sides[1].abbrev;

  return (
    <Link
      href={`/game/${game.id}`}
      title={`Game ${game.gameNumber} — ${formatDate(game.date)}`}
      className="group flex flex-col items-center rounded-lg border border-gray-700/50 bg-gray-800/50 px-2.5 py-1.5 transition-colors hover:border-gray-500 hover:bg-gray-700/60"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-gray-400">
        G{game.gameNumber}
      </span>
      <span className="font-mono text-sm font-bold tabular-nums">
        <span className={aWon ? "text-gray-100" : "text-gray-600"}>{a ?? "—"}</span>
        <span className="mx-0.5 text-gray-600">–</span>
        <span className={bWon ? "text-gray-100" : "text-gray-600"}>{b ?? "—"}</span>
      </span>
    </Link>
  );
}

function SeriesCard({ series }: { series: PlayoffSeries }) {
  const [leader, trailer] = series.sides;
  const isFinal = series.round === 4;

  const verdict = series.decided
    ? `${leader.abbrev} wins ${leader.wins}–${trailer.wins}`
    : leader.wins === trailer.wins
      ? `Tied ${leader.wins}–${trailer.wins}`
      : `${leader.abbrev} leads ${leader.wins}–${trailer.wins}`;

  const first = series.games[0];
  const last = series.games[series.games.length - 1];
  const dateRange =
    first.date === last.date
      ? formatShortDate(first.date)
      : `${formatShortDate(first.date)} – ${formatShortDate(last.date)}`;

  return (
    <div
      className={`flex flex-col rounded-xl border bg-gray-900/70 p-4 ${
        isFinal ? "border-amber-500/40" : "border-gray-700/60"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isFinal ? "text-amber-400" : "text-blue-400"
          }`}
        >
          {roundName(series.round)}
        </span>
        <span className="text-[10px] text-gray-600">{dateRange}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <TeamRow side={leader} leading={leader.wins >= trailer.wins} />
        <TeamRow side={trailer} leading={trailer.wins >= leader.wins} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-700/50 pt-3">
        <span
          className={`shrink-0 text-xs font-semibold ${
            series.decided ? "text-gray-300" : "text-gray-500"
          }`}
        >
          {verdict}
        </span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {series.games.map((g) => (
            <GameChip key={g.id} game={g} sides={series.sides} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GameCard({ game }: { game: GameForSeries }) {
  const homeWon =
    game.home.score != null && game.away.score != null && game.home.score > game.away.score;
  const awayWon =
    game.home.score != null && game.away.score != null && game.away.score > game.home.score;

  return (
    <Link
      href={`/game/${game.id}`}
      className="block rounded-xl border border-gray-700/60 bg-gray-800/60 p-3 transition-colors hover:border-gray-600 hover:bg-gray-800"
    >
      <div className="grid grid-cols-3 items-center gap-2">
        <div className={`flex items-center justify-end gap-2 ${homeWon ? "" : "opacity-70"}`}>
          <span className="text-sm font-semibold" style={{ color: getTeamDisplayColor(game.home.abbrev) }}>
            {game.home.abbrev}
          </span>
          {game.home.logoUrl && (
            <RemoteImage src={game.home.logoUrl} alt="" width={26} height={26} className="object-contain" />
          )}
        </div>
        <div className="text-center font-mono text-base font-bold tabular-nums">
          <span className={homeWon ? "text-green-400" : awayWon ? "text-red-400" : "text-gray-300"}>
            {game.home.score}
          </span>
          <span className="mx-1 text-gray-600">·</span>
          <span className={awayWon ? "text-green-400" : homeWon ? "text-red-400" : "text-gray-300"}>
            {game.away.score}
          </span>
        </div>
        <div className={`flex items-center justify-start gap-2 ${awayWon ? "" : "opacity-70"}`}>
          {game.away.logoUrl && (
            <RemoteImage src={game.away.logoUrl} alt="" width={26} height={26} className="object-contain" />
          )}
          <span className="text-sm font-semibold" style={{ color: getTeamDisplayColor(game.away.abbrev) }}>
            {game.away.abbrev}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function RecentGames() {
  // 120 covers a whole playoff plus recent regular-season games, so no series
  // arrives split across the limit.
  const { data, error } = useFetchedData<{ games: GameForSeries[] }>(
    "/api/games/recent?limit=120"
  );

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={190} rounded="lg" />
        ))}
      </div>
    );
  }

  const { series, otherGames } = groupIntoSeries(data.games);

  if (series.length === 0 && otherGames.length === 0) {
    return <div className="text-center text-gray-500">No games available</div>;
  }

  const byDate = new Map<string, GameForSeries[]>();
  for (const g of otherGames) {
    const bucket = byDate.get(g.date);
    if (bucket) bucket.push(g);
    else byDate.set(g.date, [g]);
  }

  return (
    <div className="flex flex-col gap-10">
      {series.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
            Playoff Series
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {series.map((s) => (
              <SeriesCard key={s.key} series={s} />
            ))}
          </div>
        </section>
      )}

      {byDate.size > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
            Regular Season
          </h2>
          <div className="flex flex-col gap-5">
            {Array.from(byDate.entries()).map(([date, dayGames]) => (
              <div key={date}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-blue-400">
                  {formatDate(date)}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {dayGames.map((g) => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
