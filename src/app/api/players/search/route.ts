import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, teams, shifts } from "@/db/schema";
import { ilike, asc, isNotNull, inArray, and, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const onRosterOnly = request.nextUrl.searchParams.get("onRoster") === "true";
  const minGames = parseInt(request.nextUrl.searchParams.get("minGames") ?? "0", 10);

  const qualifiedPlayerIds =
    minGames > 0
      ? db
          .select({ playerId: shifts.playerId })
          .from(shifts)
          .groupBy(shifts.playerId)
          .having(sql`COUNT(DISTINCT ${shifts.gameId}) >= ${minGames}`)
      : null;

  const where = and(
    onRosterOnly ? isNotNull(players.currentTeamId) : undefined,
    qualifiedPlayerIds ? inArray(players.id, qualifiedPlayerIds) : undefined,
    q && q.length >= 2 ? ilike(players.searchText, `%${q.toLowerCase()}%`) : undefined,
  );

  const results = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      headshotUrl: players.headshotUrl,
      teamAbbrev: teams.abbrev,
      teamName: teams.name,
      teamLogoUrl: teams.logoUrl,
    })
    .from(players)
    .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
    .where(where)
    .orderBy(asc(players.lastName))
    .limit(q && q.length >= 2 ? 50 : 1000);

  return NextResponse.json({ players: results });
}
