import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, teams, shifts, games, seasons, versusStats } from "@/db/schema";
import { ilike, asc, isNotNull, inArray, and, or, eq, gt, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const onRosterOnly = request.nextUrl.searchParams.get("onRoster") === "true";
  const minGames = parseInt(request.nextUrl.searchParams.get("minGames") ?? "0", 10);
  const versusWith = parseInt(request.nextUrl.searchParams.get("versusWith") ?? "", 10);

  // Players who have shifts in the most recent season
  const currentSeasonPlayerIds = onRosterOnly
    ? db
        .selectDistinct({ playerId: shifts.playerId })
        .from(shifts)
        .innerJoin(games, eq(shifts.gameId, games.id))
        .where(
          eq(
            games.seasonId,
            db.select({ id: seasons.id }).from(seasons).orderBy(desc(seasons.id)).limit(1)
          )
        )
    : null;

  const qualifiedPlayerIds =
    minGames > 0
      ? db
          .select({ playerId: shifts.playerId })
          .from(shifts)
          .groupBy(shifts.playerId)
          .having(sql`COUNT(DISTINCT ${shifts.gameId}) >= ${minGames}`)
      : null;

  // Filter to players that share on-ice time with the given player
  const versusPlayerIds =
    !isNaN(versusWith)
      ? db
          .selectDistinct({
            playerId: sql<number>`CASE
              WHEN ${versusStats.playerAId} = ${versusWith} THEN ${versusStats.playerBId}
              ELSE ${versusStats.playerAId}
            END`.as("player_id"),
          })
          .from(versusStats)
          .where(
            and(
              or(
                eq(versusStats.playerAId, versusWith),
                eq(versusStats.playerBId, versusWith),
              ),
              gt(versusStats.toiSharedSeconds, 0),
            ),
          )
      : null;

  const where = and(
    onRosterOnly ? isNotNull(players.currentTeamId) : undefined,
    currentSeasonPlayerIds ? inArray(players.id, currentSeasonPlayerIds) : undefined,
    qualifiedPlayerIds ? inArray(players.id, qualifiedPlayerIds) : undefined,
    versusPlayerIds ? inArray(players.id, versusPlayerIds) : undefined,
    q && q.length >= 2 ? ilike(players.searchText, `%${q.toLowerCase().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`) : undefined,
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
