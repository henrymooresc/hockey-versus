import { apiError } from "@/lib/api-error";
import { cachedJson, SCHEDULE } from "@/lib/api-cache";

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

export async function GET() {
  try {
    const res = await fetch("https://api-web.nhle.com/v1/standings/now", {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`NHL API ${res.status}`);
    const json = await res.json();

    const standings = (json.standings as NHLStandingsTeam[]).map((t) => ({
      abbrev: t.teamAbbrev.default,
      points: t.points,
      wins: t.wins,
      losses: t.losses,
      otLosses: t.otLosses,
      gamesPlayed: t.gamesPlayed,
      l10Record: `${t.l10Wins}-${t.l10Losses}-${t.l10OtLosses}`,
      streak: `${t.streakCode}${t.streakCount}`,
    }));

    return cachedJson({ standings }, SCHEDULE);
  } catch (err) {
    return apiError("Standings API error", err);
  }
}
