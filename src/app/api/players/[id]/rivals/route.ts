import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { MatchupPlayer } from "@/types/versus";

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
      GROUP BY opponent_id, player_side
    )
    SELECT
      a.*,
      p.first_name,
      p.last_name,
      p.position,
      p.headshot_url,
      p.sweater_number,
      t.abbrev AS team_abbrev,
      t.logo_url AS team_logo_url
    FROM aggregated a
    JOIN players p ON p.id = a.opponent_id
    LEFT JOIN teams t ON t.id = p.current_team_id
    ORDER BY a.toi_shared_seconds DESC
  `);

  interface AggRow {
    opponent_id: number;
    player_side: string;
    toi_shared_seconds: number;
    games_shared: number;
    first_name: string;
    last_name: string;
    position: string | null;
    headshot_url: string | null;
    sweater_number: number | null;
    team_abbrev: string | null;
    team_logo_url: string | null;
    [key: string]: unknown;
  }

  const rowsArray = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
  const opponents: MatchupPlayer[] = (rowsArray as AggRow[]).map((row) => {
    const isA = row.player_side === "A";
    const pGoals = (isA ? row.player_a_goals : row.player_b_goals) as number;
    const pAssists = (isA ? row.player_a_assists : row.player_b_assists) as number;
    const pShots = (isA ? row.player_a_shots : row.player_b_shots) as number;
    const oGoals = (isA ? row.player_b_goals : row.player_a_goals) as number;
    const oAssists = (isA ? row.player_b_assists : row.player_a_assists) as number;
    const oShots = (isA ? row.player_b_shots : row.player_a_shots) as number;
    return {
      playerId: row.opponent_id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      headshotUrl: row.headshot_url,
      sweaterNumber: row.sweater_number,
      toiSharedSeconds: row.toi_shared_seconds,
      gamesShared: row.games_shared,
      stats: {
        points: pGoals + pAssists,
        goals: pGoals,
        assists: pAssists,
        individualShots: pShots,
        shotsFor: (isA ? row.shots_for_a : row.shots_for_b) as number,
        shotsAgainst: (isA ? row.shots_against_a : row.shots_against_b) as number,
        goalsFor: (isA ? row.goals_for_a : row.goals_for_b) as number,
        goalsAgainst: (isA ? row.goals_against_a : row.goals_against_b) as number,
        hits: (isA ? row.hits_by_a : row.hits_by_b) as number,
        penalties: (isA ? row.penalties_by_a : row.penalties_by_b) as number,
        faceoffWins: (isA ? row.faceoff_wins_a : row.faceoff_wins_b) as number,
      },
      oppStats: {
        points: oGoals + oAssists,
        goals: oGoals,
        assists: oAssists,
        individualShots: oShots,
        shotsFor: (isA ? row.shots_for_b : row.shots_for_a) as number,
        shotsAgainst: (isA ? row.shots_against_b : row.shots_against_a) as number,
        goalsFor: (isA ? row.goals_for_b : row.goals_for_a) as number,
        goalsAgainst: (isA ? row.goals_against_b : row.goals_against_a) as number,
        hits: (isA ? row.hits_by_b : row.hits_by_a) as number,
        penalties: (isA ? row.penalties_by_b : row.penalties_by_a) as number,
        faceoffWins: (isA ? row.faceoff_wins_b : row.faceoff_wins_a) as number,
      },
    };
  });

  const skaterRivals = opponents.filter((o) => o.position !== "G");
  const goalieRivals = opponents.filter((o) => o.position === "G");

  return NextResponse.json({ skaterRivals, goalieRivals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Rivals API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
