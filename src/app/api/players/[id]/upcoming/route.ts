import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { players, teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UpcomingGame } from "@/types/versus";
import type { ScheduleGame } from "@/types/nhl-api";
import { cachedJson, SCHEDULE } from "@/lib/api-cache";

const WEB_API = "https://api-web.nhle.com";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const playerId = parseInt(resolvedParams.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
    }

    // Get player's current team
    const player = await db
      .select({ teamId: players.currentTeamId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player.length || !player[0].teamId) {
      return NextResponse.json({ error: "Player or team not found" }, { status: 404 });
    }

    const teamId = player[0].teamId;

    // Get team abbreviation
    const team = await db
      .select({ abbrev: teams.abbrev })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team.length) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const teamAbbrev = team[0].abbrev;

    // Fetch NHL schedule — returns ~1 week of games. `revalidate` matches the
    // window this route advertises, so one NHL call serves 5 minutes of traffic.
    const response = await fetch(`${WEB_API}/v1/schedule/now`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 502 });
    }
    const schedule = await response.json();

    // Build a map of team IDs to logo URLs from our DB
    const allTeams = await db.select({ id: teams.id, abbrev: teams.abbrev, logoUrl: teams.logoUrl }).from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.abbrev, { id: t.id, logoUrl: t.logoUrl }]));

    // Collect upcoming games involving this team
    const upcoming: UpcomingGame[] = [];
    for (const week of schedule.gameWeek ?? []) {
      for (const game of week.games as ScheduleGame[]) {
        // Only future or live games
        if (game.gameState === "OFF" || game.gameState === "FINAL") continue;

        const isHome = game.homeTeam.abbrev === teamAbbrev;
        const isAway = game.awayTeam.abbrev === teamAbbrev;
        if (!isHome && !isAway) continue;

        const oppAbbrev = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
        const oppInfo = teamMap.get(oppAbbrev);

        upcoming.push({
          gameId: game.id,
          gameDate: week.date,
          opponentTeamId: oppInfo?.id ?? (isHome ? game.awayTeam.id : game.homeTeam.id),
          opponentAbbrev: oppAbbrev,
          opponentLogoUrl: oppInfo?.logoUrl ?? null,
          isHome,
        });
      }
    }

    return cachedJson({ upcoming, teamAbbrev }, SCHEDULE);
  } catch (err: unknown) {
    return apiError("Upcoming API error", err);
  }
}
