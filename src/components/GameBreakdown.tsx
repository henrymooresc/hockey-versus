"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatSecondsToTime, formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import { Skeleton } from "./Skeleton";
import { ErrorBoundary } from "./ErrorBoundary";

interface PlayerLite {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  teamAbbrev: string | null;
  teamLogoUrl: string | null;
}

interface PerspectiveStats {
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  blocks: number;
  penalties: number;
  faceoffWins: number;
}

interface PairBreakdown {
  playerA: PlayerLite;
  playerB: PlayerLite;
  isGoalieMatchup: boolean;
  thisGame: {
    toiSharedSeconds: number;
    rivalryScore: number;
    statsA: PerspectiveStats;
    statsB: PerspectiveStats;
    wonA: boolean;
    wonB: boolean;
  };
  career: {
    gamesShared: number;
    toiSharedSeconds: number;
    avgToiPerGame: number;
    avgRivalryScore: number;
    avgStatsA: PerspectiveStats;
    avgStatsB: PerspectiveStats;
  } | null;
  rivalryDelta: number | null;
}

interface GameInfo {
  id: number;
  seasonId: string;
  date: string;
  home: { id: number | null; abbrev: string | null; name: string | null; logoUrl: string | null; score: number | null };
  away: { id: number | null; abbrev: string | null; name: string | null; logoUrl: string | null; score: number | null };
}

interface BreakdownResponse {
  game: GameInfo;
  pairs: PairBreakdown[];
}

function formatDate(s: string): string {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function PlayerHeader({ player, align }: { player: PlayerLite; align: "left" | "right" }) {
  const colors = getTeamColors(player.teamAbbrev);
  return (
    <div className={`flex items-center gap-3 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {player.headshotUrl ? (
        <img
          src={player.headshotUrl}
          alt=""
          className="rounded-full object-cover shrink-0"
          style={{ width: 52, height: 52, border: `2px solid ${colors.primary}80` }}
        />
      ) : (
        <div className="rounded-full bg-gray-700 shrink-0" style={{ width: 52, height: 52 }} />
      )}
      <div className="min-w-0">
        <div className="text-lg font-semibold text-white truncate">
          {player.firstName} {player.lastName}
        </div>
        <div className={`flex items-center gap-1.5 text-xs text-gray-500 ${align === "right" ? "justify-end" : ""}`}>
          {player.teamLogoUrl && (
            <img src={player.teamLogoUrl} alt="" className="object-contain" style={{ width: 16, height: 16 }} />
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

function StatCompareRow({
  label,
  gameA,
  gameB,
  avgA,
  avgB,
  decimals = 0,
}: {
  label: string;
  gameA: number;
  gameB: number;
  avgA: number | null;
  avgB: number | null;
  decimals?: number;
}) {
  const aWin = gameA > gameB;
  const bWin = gameB > gameA;
  return (
    <div className="grid grid-cols-5 items-center text-base py-1">
      <div className={`text-right font-mono font-semibold ${aWin ? "text-green-400" : bWin ? "text-red-400" : "text-gray-300"}`}>
        {gameA}
      </div>
      <div className="text-right font-mono text-xs text-gray-600">
        {avgA != null ? avgA.toFixed(decimals === 0 ? 1 : decimals) : "—"}
      </div>
      <div className="text-center text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-left font-mono text-xs text-gray-600">
        {avgB != null ? avgB.toFixed(decimals === 0 ? 1 : decimals) : "—"}
      </div>
      <div className={`text-left font-mono font-semibold ${bWin ? "text-green-400" : aWin ? "text-red-400" : "text-gray-300"}`}>
        {gameB}
      </div>
    </div>
  );
}

function PairCard({ pair, rank }: { pair: PairBreakdown; rank: number }) {
  const { playerA, playerB, thisGame, career, rivalryDelta } = pair;
  const arrow = rivalryDelta == null ? "" : rivalryDelta > 0.5 ? "↑" : rivalryDelta < -0.5 ? "↓" : "→";
  const arrowColor = rivalryDelta == null ? "text-gray-500" : rivalryDelta > 0.5 ? "text-green-400" : rivalryDelta < -0.5 ? "text-red-400" : "text-gray-400";

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-800/50 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-center font-mono text-sm font-bold text-gray-600 w-6">{rank}</div>
        <div className="flex-1 grid grid-cols-[1fr_60px_1fr] items-center gap-4">
          <PlayerHeader player={playerA} align="right" />
          <div className="text-center text-xs uppercase tracking-widest text-gray-600">vs</div>
          <PlayerHeader player={playerB} align="left" />
        </div>
      </div>

      <div className="grid grid-cols-3 items-center gap-3 mb-5 rounded-lg bg-gray-900/40 px-4 py-3">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-gray-500">Shared TOI</div>
          <div className="mt-1 font-mono text-xl font-bold text-white">{formatSecondsToTime(thisGame.toiSharedSeconds)}</div>
          {career && (
            <div className="text-xs text-gray-500">avg {formatSecondsToTime(Math.round(career.avgToiPerGame))}</div>
          )}
        </div>
        <div className="text-center border-x border-gray-700/50">
          <div className="text-xs uppercase tracking-widest text-gray-500">Game Rivalry</div>
          <div className={`mt-1 font-mono text-2xl font-bold ${thisGame.rivalryScore > 0 ? "text-amber-400" : "text-gray-400"}`}>
            {thisGame.rivalryScore.toFixed(2)}
          </div>
          {rivalryDelta != null && (
            <div className={`text-xs font-mono ${arrowColor}`}>
              {arrow} {rivalryDelta > 0 ? "+" : ""}{rivalryDelta.toFixed(2)} vs typical
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-gray-500">Career Avg</div>
          <div className="mt-1 font-mono text-xl font-bold text-gray-300">
            {career ? career.avgRivalryScore.toFixed(2) : "—"}
          </div>
          {career && (
            <div className="text-xs text-gray-500">{career.gamesShared} GP · {formatSecondsToHMS(career.toiSharedSeconds)}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 text-xs uppercase tracking-wider text-gray-600 pb-1.5 mb-1.5 border-b border-gray-800/80">
        <div className="text-right">Game</div>
        <div className="text-right">Avg</div>
        <div />
        <div className="text-left">Avg</div>
        <div className="text-left">Game</div>
      </div>

      <StatCompareRow label="Goals" gameA={thisGame.statsA.goals} gameB={thisGame.statsB.goals} avgA={career?.avgStatsA.goals ?? null} avgB={career?.avgStatsB.goals ?? null} />
      <StatCompareRow label="Assists" gameA={thisGame.statsA.assists} gameB={thisGame.statsB.assists} avgA={career?.avgStatsA.assists ?? null} avgB={career?.avgStatsB.assists ?? null} />
      <StatCompareRow label="Shots" gameA={thisGame.statsA.shots} gameB={thisGame.statsB.shots} avgA={career?.avgStatsA.shots ?? null} avgB={career?.avgStatsB.shots ?? null} />
      {!pair.isGoalieMatchup && (
        <>
          <StatCompareRow label="Hits" gameA={thisGame.statsA.hits} gameB={thisGame.statsB.hits} avgA={career?.avgStatsA.hits ?? null} avgB={career?.avgStatsB.hits ?? null} />
          <StatCompareRow label="Blocks" gameA={thisGame.statsA.blocks} gameB={thisGame.statsB.blocks} avgA={career?.avgStatsA.blocks ?? null} avgB={career?.avgStatsB.blocks ?? null} />
        </>
      )}
    </div>
  );
}

function GameHeader({ game }: { game: GameInfo }) {
  const homeColors = getTeamColors(game.home.abbrev);
  const awayColors = getTeamColors(game.away.abbrev);
  const homeWon = game.home.score != null && game.away.score != null && game.home.score > game.away.score;
  const awayWon = game.home.score != null && game.away.score != null && game.away.score > game.home.score;

  return (
    <div className="rounded-2xl border border-gray-700/60 bg-gray-900/90 px-6 py-5">
      <div className="text-center text-xs uppercase tracking-widest text-gray-500 mb-3">
        {formatDate(game.date)}
      </div>
      <div className="grid grid-cols-3 items-center gap-4">
        <div className="flex items-center justify-end gap-3">
          <div className={`text-right ${homeWon ? "" : "opacity-70"}`}>
            <div className="text-base font-bold" style={{ color: getTeamDisplayColor(game.home.abbrev) }}>
              {game.home.name ?? game.home.abbrev}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">home</div>
          </div>
          {game.home.logoUrl && (
            <img src={game.home.logoUrl} alt="" className="object-contain" style={{ width: 48, height: 48, filter: homeWon ? undefined : "saturate(0.6)" }} />
          )}
        </div>
        <div className="text-center">
          <div className="font-mono text-3xl font-bold">
            <span className={homeWon ? "text-green-400" : awayWon ? "text-red-400" : "text-gray-300"}>{game.home.score ?? "—"}</span>
            <span className="mx-2 text-gray-600">·</span>
            <span className={awayWon ? "text-green-400" : homeWon ? "text-red-400" : "text-gray-300"}>{game.away.score ?? "—"}</span>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-600">Final</div>
        </div>
        <div className="flex items-center justify-start gap-3">
          {game.away.logoUrl && (
            <img src={game.away.logoUrl} alt="" className="object-contain" style={{ width: 48, height: 48, filter: awayWon ? undefined : "saturate(0.6)" }} />
          )}
          <div className={`${awayWon ? "" : "opacity-70"}`}>
            <div className="text-base font-bold" style={{ color: getTeamDisplayColor(game.away.abbrev) }}>
              {game.away.name ?? game.away.abbrev}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">away</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerListPicker({
  label,
  teamAbbrev,
  teamLogoUrl,
  players,
  selected,
  onSelect,
}: {
  label: string;
  teamAbbrev: string | null;
  teamLogoUrl: string | null;
  players: PlayerLite[];
  selected: PlayerLite | null;
  onSelect: (p: PlayerLite | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {teamLogoUrl && (
          <img src={teamLogoUrl} alt="" className="object-contain" style={{ width: 30, height: 30 }} />
        )}
        <span className="text-base font-bold uppercase tracking-widest" style={{ color: getTeamDisplayColor(teamAbbrev) }}>
          {label}
        </span>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-xl border bg-gray-800/60 px-4 py-3 text-left transition-all duration-150 hover:bg-gray-800 ${
          open ? "border-blue-500" : "border-gray-700/60"
        }`}
      >
        {selected ? (
          <>
            {selected.headshotUrl ? (
              <img src={selected.headshotUrl} alt="" className="rounded-full object-cover ring-1 ring-gray-600 shrink-0" style={{ width: 44, height: 44 }} />
            ) : (
              <div className="rounded-full bg-gray-700 shrink-0" style={{ width: 44, height: 44 }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-white truncate">
                {selected.firstName} {selected.lastName}
              </div>
              <div className="text-xs text-gray-500">{selected.position ?? "—"}</div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onSelect(null); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onSelect(null); setOpen(false); } }}
              className="rounded p-1.5 text-gray-500 hover:text-white hover:bg-gray-700/50 transition-colors cursor-pointer text-base"
              title="Clear"
            >
              ✕
            </span>
          </>
        ) : (
          <span className="flex-1 text-base text-gray-500">Select a player…</span>
        )}
        <span className={`text-gray-500 text-base transition-transform duration-200 inline-block ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <ul
          className="absolute left-0 right-0 z-20 mt-1 flex flex-col rounded-xl border border-gray-700/60 bg-gray-800 shadow-xl shadow-black/40 overflow-auto"
          style={{ maxHeight: "26rem", top: "100%" }}
        >
          {players.map((player) => {
            const isSelected = selected?.id === player.id;
            return (
              <li key={player.id}>
                <button
                  onClick={() => { onSelect(player); setOpen(false); }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                    isSelected ? "bg-blue-950/40 border-l-2 border-blue-500" : "border-l-2 border-transparent hover:bg-gray-700/60"
                  }`}
                >
                  {player.headshotUrl ? (
                    <img src={player.headshotUrl} alt="" className="rounded-full object-cover ring-1 ring-gray-600 shrink-0" style={{ width: 36, height: 36 }} />
                  ) : (
                    <div className="rounded-full bg-gray-700 shrink-0" style={{ width: 36, height: 36 }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-white truncate">
                      {player.firstName} {player.lastName}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{player.position ?? "—"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface PlayerWithRivalry extends PlayerLite {
  topRivalryScore: number;
}

function buildRoster(
  pairs: PairBreakdown[],
  side: "home" | "away",
  homeAbbrev: string | null,
  awayAbbrev: string | null
): PlayerWithRivalry[] {
  const targetAbbrev = side === "home" ? homeAbbrev : awayAbbrev;
  const map = new Map<number, PlayerWithRivalry>();
  for (const p of pairs) {
    for (const player of [p.playerA, p.playerB]) {
      if (player.teamAbbrev !== targetAbbrev) continue;
      const existing = map.get(player.id);
      const score = p.thisGame.rivalryScore;
      if (!existing || score > existing.topRivalryScore) {
        map.set(player.id, { ...player, topRivalryScore: Math.max(existing?.topRivalryScore ?? 0, score) });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.topRivalryScore - a.topRivalryScore);
}

function findPair(
  pairs: PairBreakdown[],
  playerAId: number,
  playerBId: number
): PairBreakdown | null {
  return pairs.find(
    (p) =>
      (p.playerA.id === playerAId && p.playerB.id === playerBId) ||
      (p.playerA.id === playerBId && p.playerB.id === playerAId)
  ) ?? null;
}

export function GameBreakdown({ gameId }: { gameId: number }) {
  const [data, setData] = useState<BreakdownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awayPlayer, setAwayPlayer] = useState<PlayerLite | null>(null);
  const [homePlayer, setHomePlayer] = useState<PlayerLite | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setAwayPlayer(null);
    setHomePlayer(null);
    fetch(`/api/games/${gameId}/breakdown`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load game breakdown");
        return j;
      })
      .then((d: BreakdownResponse) => {
        setData(d);
        // Pre-select the top pair so the page isn't empty on landing.
        const top = d.pairs[0];
        if (top) {
          if (top.playerA.teamAbbrev === d.game.away.abbrev) {
            setAwayPlayer(top.playerA);
            setHomePlayer(top.playerB);
          } else {
            setAwayPlayer(top.playerB);
            setHomePlayer(top.playerA);
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [gameId]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton height={120} rounded="lg" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton height={350} rounded="lg" />
          <Skeleton height={350} rounded="lg" />
        </div>
      </div>
    );
  }

  const awayRoster = buildRoster(data.pairs, "away", data.game.home.abbrev, data.game.away.abbrev);
  const homeRoster = buildRoster(data.pairs, "home", data.game.home.abbrev, data.game.away.abbrev);

  const selectedPair = awayPlayer && homePlayer
    ? findPair(data.pairs, awayPlayer.id, homePlayer.id)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <GameHeader game={data.game} />

      <div className="grid gap-4 md:grid-cols-2">
        <PlayerListPicker
          label={data.game.home.abbrev ?? "Home"}
          teamAbbrev={data.game.home.abbrev}
          teamLogoUrl={data.game.home.logoUrl}
          players={homeRoster}
          selected={homePlayer}
          onSelect={setHomePlayer}
        />
        <PlayerListPicker
          label={data.game.away.abbrev ?? "Away"}
          teamAbbrev={data.game.away.abbrev}
          teamLogoUrl={data.game.away.logoUrl}
          players={awayRoster}
          selected={awayPlayer}
          onSelect={setAwayPlayer}
        />
      </div>

      <div>
        {!awayPlayer || !homePlayer ? (
          <div className="rounded-xl border border-dashed border-gray-700/60 bg-gray-900/30 px-6 py-10 text-center text-sm text-gray-500">
            Pick a player from each team to see how they matched up.
          </div>
        ) : !selectedPair ? (
          <div className="rounded-xl border border-dashed border-gray-700/60 bg-gray-900/30 px-6 py-10 text-center text-sm text-gray-500">
            {awayPlayer.firstName} {awayPlayer.lastName} and {homePlayer.firstName} {homePlayer.lastName} did not share the ice in this game.
          </div>
        ) : (
          <ErrorBoundary fallback={null}>
            <PairCard pair={selectedPair} rank={data.pairs.indexOf(selectedPair) + 1} />
          </ErrorBoundary>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link href="/games" className="text-xs text-gray-500 hover:text-gray-300">
          ← back to recent games
        </Link>
      </div>
    </div>
  );
}
