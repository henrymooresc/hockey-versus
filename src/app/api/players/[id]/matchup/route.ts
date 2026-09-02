import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows, parseGameTypeFilter, gameTypeClause } from "@/lib/db-utils";
import { mapAggRowToMatchup, emptyMatchupStats, type AggRow } from "@/lib/matchup-mapper";
import { cachedJson, DERIVED } from "@/lib/api-cache";
import type { MatchupPlayer } from "@/types/versus";

/**
 * Returns aggregated versus stats for a player against all players
 * on a given opponent team's current roster.
 *
 * GET /api/players/{id}/matchup?teamId={opponentTeamId}&seasons={a,b}&gameType={t}
 * Omit `seasons` for every season combined.
 */
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

    const teamId = parseInt(
      request.nextUrl.searchParams.get("teamId") ?? "",
      10
    );
    const gtFilter = parseGameTypeFilter(request.nextUrl.searchParams.get("gameType"));
    const seasonsParam = request.nextUrl.searchParams.get("seasons");
    const seasonFilter = seasonsParam ? seasonsParam.split(",").filter(Boolean) : null;
    if (isNaN(teamId)) {
      return NextResponse.json(
        { error: "teamId query parameter required" },
        { status: 400 }
      );
    }

    const playerRows = await db.execute(sql`
      SELECT position FROM players WHERE id = ${playerId}
    `);
    const requestingPosition =
      unwrapRows<{ position: string | null }>(playerRows)[0]?.position ?? null;

    const rows = await db.execute(sql`
      WITH aggregated AS (
        SELECT
          CASE WHEN player_a_id = ${playerId} THEN player_b_id ELSE player_a_id END AS opponent_id,
          CASE WHEN player_a_id = ${playerId} THEN 'A' ELSE 'B' END AS player_side,
          SUM(toi_shared_seconds)::int AS toi_shared_seconds,
          SUM(games_shared)::int AS games_shared,
          SUM(player_a_goals)::int AS player_a_goals,
          SUM(player_a_assists)::int AS player_a_assists,
          SUM(player_a_shots)::int AS player_a_shots,
          SUM(player_b_goals)::int AS player_b_goals,
          SUM(player_b_assists)::int AS player_b_assists,
          SUM(player_b_shots)::int AS player_b_shots,
          SUM(goals_for_a)::int AS goals_for_a,
          SUM(goals_against_a)::int AS goals_against_a,
          SUM(goals_for_b)::int AS goals_for_b,
          SUM(goals_against_b)::int AS goals_against_b,
          SUM(shots_for_a)::int AS shots_for_a,
          SUM(shots_against_a)::int AS shots_against_a,
          SUM(shots_for_b)::int AS shots_for_b,
          SUM(shots_against_b)::int AS shots_against_b,
          SUM(hits_by_a)::int AS hits_by_a,
          SUM(hits_by_b)::int AS hits_by_b,
          SUM(blocks_by_a)::int AS blocks_by_a,
          SUM(blocks_by_b)::int AS blocks_by_b,
          SUM(penalty_minutes_a)::int AS penalty_minutes_a,
          SUM(penalty_minutes_b)::int AS penalty_minutes_b,
          SUM(penalty_shots_a)::int AS penalty_shots_a,
          SUM(penalty_shots_b)::int AS penalty_shots_b,
          SUM(faceoff_wins_a)::int AS faceoff_wins_a,
          SUM(faceoff_wins_b)::int AS faceoff_wins_b,
          SUM(wins_a)::int AS wins_a,
          SUM(wins_b)::int AS wins_b
        FROM versus_stats
        WHERE (player_a_id = ${playerId} OR player_b_id = ${playerId})
          AND same_team = false
          AND toi_shared_seconds > 0
          ${seasonFilter ? sql`AND season_id IN (${sql.join(seasonFilter.map((s) => sql`${s}`), sql`, `)})` : sql``}
          ${gameTypeClause(gtFilter)}
        GROUP BY opponent_id, player_side
      )
      SELECT
        a.*,
        p.first_name,
        p.last_name,
        p.position,
        p.headshot_url,
        p.sweater_number,
        p.birth_date,
        t.abbrev AS team_abbrev,
        t.name AS team_name,
        t.logo_url AS team_logo_url
      FROM aggregated a
      JOIN players p ON p.id = a.opponent_id
      LEFT JOIN teams t ON t.id = p.current_team_id
      WHERE p.current_team_id = ${teamId}
      ORDER BY a.toi_shared_seconds DESC
    `);

    const matchups = unwrapRows<AggRow>(rows).map((row) =>
      mapAggRowToMatchup(row, requestingPosition)
    );

    // Also return opponent roster players with no versus data
    const matchupPlayerIds = new Set(matchups.map((m) => m.playerId));
    const rosterRows = await db.execute(sql`
      SELECT p.id, p.first_name, p.last_name, p.position, p.headshot_url, p.sweater_number, p.birth_date,
             t.abbrev AS team_abbrev, t.name AS team_name, t.logo_url AS team_logo_url
      FROM players p
      LEFT JOIN teams t ON t.id = p.current_team_id
      WHERE p.current_team_id = ${teamId}
    `);

    interface RosterRow {
      id: number;
      first_name: string;
      last_name: string;
      position: string | null;
      headshot_url: string | null;
      sweater_number: number | null;
      birth_date: string | null;
      team_abbrev: string | null;
      team_name: string | null;
      team_logo_url: string | null;
    }

    const noHistory: MatchupPlayer[] = unwrapRows<RosterRow>(rosterRows)
      .filter((row) => row.id !== playerId && !matchupPlayerIds.has(row.id))
      .map((row) => ({
        playerId: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        position: row.position,
        headshotUrl: row.headshot_url,
        sweaterNumber: row.sweater_number,
        birthDate: row.birth_date ?? null,
        teamAbbrev: row.team_abbrev ?? null,
        teamName: row.team_name ?? null,
        teamLogoUrl: row.team_logo_url ?? null,
        gamesShared: 0,
        toiSharedSeconds: 0,
        rivalryScore: 0,
        stats: emptyMatchupStats(),
        oppStats: emptyMatchupStats(),
      }));

    return cachedJson({ matchups: [...matchups, ...noHistory] }, DERIVED);
  } catch (err: unknown) {
    return apiError("Matchup API error", err);
  }
}
