import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { mapAggRowToMatchup, type AggRow } from "@/lib/matchup-mapper";

/**
 * Returns all opponents (split into skaters and goalies) with full stats
 * in MatchupPlayer format, sorted by shared TOI descending.
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

  const searchParams = request.nextUrl.searchParams;
  const seasonsParam = searchParams.get("seasons");
  const seasonFilter = seasonsParam ? seasonsParam.split(",").filter(Boolean) : null;

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
        SUM(penalties_by_a)::int AS penalties_by_a,
        SUM(penalties_by_b)::int AS penalties_by_b,
        SUM(faceoff_wins_a)::int AS faceoff_wins_a,
        SUM(faceoff_wins_b)::int AS faceoff_wins_b,
        SUM(wins_a)::int AS wins_a,
        SUM(wins_b)::int AS wins_b
      FROM versus_stats
      WHERE (player_a_id = ${playerId} OR player_b_id = ${playerId})
        AND same_team = false
        AND toi_shared_seconds > 0
        ${seasonFilter ? sql`AND season_id IN (${sql.join(seasonFilter.map((s) => sql`${s}`), sql`, `)})` : sql``}
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
      t.logo_url AS team_logo_url
    FROM aggregated a
    JOIN players p ON p.id = a.opponent_id
    LEFT JOIN teams t ON t.id = p.current_team_id
    ORDER BY a.toi_shared_seconds DESC
  `);

  const opponents = unwrapRows<AggRow>(rows).map(mapAggRowToMatchup);

  const skaterRivals = opponents.filter((o) => o.position !== "G");
  const goalieRivals = opponents.filter((o) => o.position === "G");

  return NextResponse.json({ skaterRivals, goalieRivals });
  } catch (err: unknown) {
    console.error("Rivals API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
