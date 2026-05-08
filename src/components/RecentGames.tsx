"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getTeamDisplayColor } from "@/lib/team-colors";
import { Skeleton } from "./Skeleton";

interface GameSummary {
  id: number;
  date: string;
  home: { abbrev: string | null; name: string | null; logoUrl: string | null; score: number | null };
  away: { abbrev: string | null; name: string | null; logoUrl: string | null; score: number | null };
}

function formatDate(s: string): string {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function GameCard({ game }: { game: GameSummary }) {
  const homeWon = game.home.score != null && game.away.score != null && game.home.score > game.away.score;
  const awayWon = game.home.score != null && game.away.score != null && game.away.score > game.home.score;
  return (
    <Link
      href={`/game/${game.id}`}
      className="block rounded-xl border border-gray-700/60 bg-gray-800/60 hover:bg-gray-800 hover:border-gray-600 transition-colors p-4"
    >
      <div className="grid grid-cols-3 items-center gap-2">
        <div className={`flex items-center justify-end gap-2 ${homeWon ? "" : "opacity-70"}`}>
          <span className="text-sm font-semibold" style={{ color: getTeamDisplayColor(game.home.abbrev) }}>
            {game.home.abbrev}
          </span>
          {game.home.logoUrl && (
            <img src={game.home.logoUrl} alt="" className="object-contain" style={{ width: 28, height: 28 }} />
          )}
        </div>
        <div className="text-center font-mono text-base font-bold">
          <span className={homeWon ? "text-green-400" : awayWon ? "text-red-400" : "text-gray-300"}>{game.home.score}</span>
          <span className="mx-1 text-gray-600">·</span>
          <span className={awayWon ? "text-green-400" : homeWon ? "text-red-400" : "text-gray-300"}>{game.away.score}</span>
        </div>
        <div className={`flex items-center justify-start gap-2 ${awayWon ? "" : "opacity-70"}`}>
          {game.away.logoUrl && (
            <img src={game.away.logoUrl} alt="" className="object-contain" style={{ width: 28, height: 28 }} />
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
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/games/recent?limit=60")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load games");
        return j;
      })
      .then((d) => setGames(d.games))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (!games) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} height={88} rounded="lg" />
        ))}
      </div>
    );
  }

  if (games.length === 0) {
    return <div className="text-center text-gray-500">No games available</div>;
  }

  // Group by date
  const byDate = new Map<string, GameSummary[]>();
  for (const g of games) {
    if (!byDate.has(g.date)) byDate.set(g.date, []);
    byDate.get(g.date)!.push(g);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(byDate.entries()).map(([date, dayGames]) => (
        <div key={date}>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-blue-400">
            {formatDate(date)}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dayGames.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
