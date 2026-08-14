import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { players, teams, seasons, versusStats, playerSeasonTotals } from "@/db/schema";
import { ilike, asc, isNotNull, inArray, and, or, eq, gt, desc, sql } from "drizzle-orm";
import { cachedJson, DERIVED } from "@/lib/api-cache";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const onRosterOnly = request.nextUrl.searchParams.get("onRoster") === "true";
    const minGames = parseInt(request.nextUrl.searchParams.get("minGames") ?? "0", 10);
    const versusWith = parseInt(request.nextUrl.searchParams.get("versusWith") ?? "", 10);

    // Players with recorded ice time in the most recent season
    const currentSeasonPlayerIds = onRosterOnly
      ? db
          .select({ playerId: playerSeasonTotals.playerId })
          .from(playerSeasonTotals)
          .where(
            eq(
              playerSeasonTotals.seasonId,
              db.select({ id: seasons.id }).from(seasons).orderBy(desc(seasons.id)).limit(1)
            )
          )
      : null;

    const qualifiedPlayerIds =
      minGames > 0
        ? db
            .select({ playerId: playerSeasonTotals.playerId })
            .from(playerSeasonTotals)
            .groupBy(playerSeasonTotals.playerId)
            .having(sql`SUM(${playerSeasonTotals.gamesPlayed}) >= ${minGames}`)
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
        sweaterNumber: players.sweaterNumber,
        birthDate: players.birthDate,
        teamAbbrev: teams.abbrev,
        teamName: teams.name,
        teamLogoUrl: teams.logoUrl,
      })
      .from(players)
      .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
      .where(where)
      .orderBy(asc(players.lastName))
      .limit(q && q.length >= 2 ? 50 : 1000);

    return cachedJson({ players: results }, DERIVED);
  } catch (err: unknown) {
    return apiError("Player search API error", err);
  }
}
