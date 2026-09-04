import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import {
  players,
  teams,
  seasons,
  versusStats,
  playerSeasonTotals,
  playerSeasonStats,
} from "@/db/schema";
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

    /**
     * Prominence: how likely a hockey fan is to recognise this player.
     *
     * Ice time alone ranked defencemen above forwards, because a top-pair
     * defenceman plays 25 minutes and a first-line centre 21. On Edmonton that
     * put Bouchard and Nurse ahead of McDavid, which is the opposite of what a
     * picker is for. The fix is to score minutes *and* output.
     *
     * Both components are percentile ranks **within the player's own position
     * group**, then averaged. Percentiles rather than raw values because the
     * units do not compare: points run 0 to 140 and save percentage 0.87 to
     * 0.93, so any linear blend would be dominated by whichever has the wider
     * spread. Within position group because it is the only way a goalie and a
     * skater can be placed on one scale at all — the best of each lands near
     * 1.0, a fringe player near 0.
     *
     * - Skaters pair ice time with points.
     * - Goalies pair ice time with save percentage, which needs a minimum
     *   workload or a backup with two clean periods outranks a starter.
     *
     * All ranks are league-wide, so the ordering inside one team reflects
     * standing across the league rather than only among team-mates.
     */
    const GOALIE_MIN_SHOTS = 200;

    const prominence = db
      .select({
        playerId: playerSeasonTotals.playerId,
        latestToi: sql<number>`COALESCE(SUM(${playerSeasonTotals.toiSeconds}) FILTER (
          WHERE ${playerSeasonTotals.seasonId} = (SELECT MAX(${seasons.id}) FROM ${seasons})
        ), 0)::int`.as("latest_toi"),
        score: sql<number>`
          (
            PERCENT_RANK() OVER (
              PARTITION BY (${players.position} = 'G')
              ORDER BY COALESCE(SUM(${playerSeasonTotals.toiSeconds}) FILTER (
                WHERE ${playerSeasonTotals.seasonId} = (SELECT MAX(${seasons.id}) FROM ${seasons})
              ), 0)
            )
            + PERCENT_RANK() OVER (
              PARTITION BY (${players.position} = 'G')
              ORDER BY CASE
                WHEN ${players.position} = 'G' THEN
                  CASE WHEN SUM(${playerSeasonStats.saves} + ${playerSeasonStats.goalsAgainst}) >= ${GOALIE_MIN_SHOTS}
                    THEN SUM(${playerSeasonStats.saves})::numeric
                         / NULLIF(SUM(${playerSeasonStats.saves} + ${playerSeasonStats.goalsAgainst}), 0)
                    ELSE 0 END
                ELSE SUM(${playerSeasonStats.goals} + ${playerSeasonStats.assists})
              END
            )
          ) / 2
        `.as("score"),
      })
      .from(playerSeasonTotals)
      .innerJoin(players, eq(players.id, playerSeasonTotals.playerId))
      .leftJoin(
        playerSeasonStats,
        and(
          eq(playerSeasonStats.playerId, playerSeasonTotals.playerId),
          eq(playerSeasonStats.seasonId, playerSeasonTotals.seasonId),
          eq(playerSeasonStats.gameType, playerSeasonTotals.gameType)
        )
      )
      .groupBy(playerSeasonTotals.playerId, players.position)
      .as("toi");

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
      .leftJoin(prominence, eq(prominence.playerId, players.id))
      .where(where)
      /**
       * Most prominent first, so the names a hockey fan knows sit at the top
       * of each team.
       *
       * `NULLS LAST` is load-bearing. A player with no `player_season_totals`
       * row at all misses the LEFT JOIN and comes back null, and Postgres
       * sorts nulls *first* under DESC. Without this the never-played players
       * lead the list on any call that does not pass `minGames`.
       */
      .orderBy(sql`${prominence.score} DESC NULLS LAST`, asc(players.lastName))
      .limit(q && q.length >= 2 ? 50 : 1000);

    return cachedJson({ players: results }, DERIVED);
  } catch (err: unknown) {
    return apiError("Player search API error", err);
  }
}
