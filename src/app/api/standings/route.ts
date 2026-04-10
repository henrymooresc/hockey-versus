import { NextResponse } from "next/server";

interface NHLStandingsTeam {
  teamAbbrev: { default: string };
  teamName: { default: string };
  teamLogo: string;
  points: number;
  wins: number;
  losses: number;
  otLosses: number;
  gamesPlayed: number;
  l10Wins: number;
  l10Losses: number;
  l10OtLosses: number;
  streakCode: string;
  streakCount: number;
}

export interface StandingsEntry {
  abbrev: string;
  points: number;
  wins: number;
  losses: number;
  otLosses: number;
  gamesPlayed: number;
  l10Record: string;
  streak: string;
}

let cache: { data: StandingsEntry[]; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return NextResponse.json({ standings: cache.data });
    }

    const res = await fetch("https://api-web.nhle.com/v1/standings/now", {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`NHL API ${res.status}`);
    const json = await res.json();

    const standings: StandingsEntry[] = (json.standings as NHLStandingsTeam[]).map((t) => ({
      abbrev: t.teamAbbrev.default,
      points: t.points,
      wins: t.wins,
      losses: t.losses,
      otLosses: t.otLosses,
      gamesPlayed: t.gamesPlayed,
      l10Record: `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`,
      streak: `${t.streakCode}${t.streakCount}`,
    }));

    cache = { data: standings, fetchedAt: Date.now() };
    return NextResponse.json({ standings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Standings API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
