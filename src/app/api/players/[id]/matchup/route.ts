import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { MatchupPlayer } from "@/types/versus";
import { computeSkaterRivalryScore, computeGoalieRivalryScore } from "@/lib/rivalry-score";

/**
 * Returns aggregated versus stats for a player against all players
 * on a given opponent team's current roster.
 *
 * GET /api/players/{id}/matchup?teamId={opponentTeamId}
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
    if (isNaN(teamId)) {
      return NextResponse.json(
        { error: "teamId query parameter required" },
        { status: 400 }
      );
    }

    // Get all versus stats for this player against players currently on the opponent team,
    // aggregated across all seasons, only opponents (sameTeam = false)
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
        GROUP BY opponent_id, player_side
      )
      SELECT
        a.*,
        p.first_name,
        p.last_name,
        p.position,
        p.headshot_url,
        p.sweater_number
      FROM aggregated a
      JOIN players p ON p.id = a.opponent_id
      WHERE p.current_team_id = ${teamId}
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
      [key: string]: unknown;
    }

    const rowsArray = Array.isArray(rows) ? rows : (rows as any).rows ?? [];

    const matchups: MatchupPlayer[] = (rowsArray as AggRow[]).map((row) => {
      const isA = row.player_side === "A";
      const pGoals = (isA ? row.player_a_goals : row.player_b_goals) as number;
      const pAssists = (isA ? row.player_a_assists : row.player_b_assists) as number;
      const oGoals = (isA ? row.player_b_goals : row.player_a_goals) as number;
      const oAssists = (isA ? row.player_b_assists : row.player_a_assists) as number;
      const pShots = isA ? row.player_a_shots as number : row.player_b_shots as number;
      const oShots = isA ? row.player_b_shots as number : row.player_a_shots as number;
      const isGoalie = row.position === "G";
      const rivalryScore = isGoalie
        ? computeGoalieRivalryScore({
            toiSharedSeconds: row.toi_shared_seconds as number,
            skaterShots: pShots,
            skaterGoals: pGoals,
            winsA: (isA ? row.wins_a : row.wins_b) as number,
            winsB: (isA ? row.wins_b : row.wins_a) as number,
          })
        : computeSkaterRivalryScore({
            toiSharedSeconds: row.toi_shared_seconds as number,
            hitsByA: (isA ? row.hits_by_a : row.hits_by_b) as number,
            hitsByB: (isA ? row.hits_by_b : row.hits_by_a) as number,
            blocksByA: (isA ? row.blocks_by_a : row.blocks_by_b) as number,
            blocksByB: (isA ? row.blocks_by_b : row.blocks_by_a) as number,
            penaltiesByA: (isA ? row.penalties_by_a : row.penalties_by_b) as number,
            penaltiesByB: (isA ? row.penalties_by_b : row.penalties_by_a) as number,
            faceoffWinsA: (isA ? row.faceoff_wins_a : row.faceoff_wins_b) as number,
            faceoffWinsB: (isA ? row.faceoff_wins_b : row.faceoff_wins_a) as number,
            playerAGoals: pGoals,
            playerAAssists: pAssists,
            playerAShots: pShots,
            playerBGoals: oGoals,
            playerBAssists: oAssists,
            playerBShots: oShots,
            winsA: (isA ? row.wins_a : row.wins_b) as number,
            winsB: (isA ? row.wins_b : row.wins_a) as number,
          });
      return {
        playerId: row.opponent_id,
        firstName: row.first_name,
        lastName: row.last_name,
        position: row.position,
        headshotUrl: row.headshot_url,
        sweaterNumber: row.sweater_number,
        gamesShared: row.games_shared,
        toiSharedSeconds: row.toi_shared_seconds,
        rivalryScore,
        stats: {
          points: pGoals + pAssists,
          goals: pGoals,
          assists: pAssists,
          individualShots: isA ? row.player_a_shots as number : row.player_b_shots as number,
          shotsFor: isA ? row.shots_for_a as number : row.shots_for_b as number,
          shotsAgainst: isA ? row.shots_against_a as number : row.shots_against_b as number,
          goalsFor: isA ? row.goals_for_a as number : row.goals_for_b as number,
          goalsAgainst: isA ? row.goals_against_a as number : row.goals_against_b as number,
          hits: isA ? row.hits_by_a as number : row.hits_by_b as number,
          blocks: isA ? row.blocks_by_a as number : row.blocks_by_b as number,
          penalties: isA ? row.penalties_by_a as number : row.penalties_by_b as number,
          faceoffWins: isA ? row.faceoff_wins_a as number : row.faceoff_wins_b as number,
        },
        oppStats: {
          points: oGoals + oAssists,
          goals: oGoals,
          assists: oAssists,
          individualShots: isA ? row.player_b_shots as number : row.player_a_shots as number,
          shotsFor: isA ? row.shots_for_b as number : row.shots_for_a as number,
          shotsAgainst: isA ? row.shots_against_b as number : row.shots_against_a as number,
          goalsFor: isA ? row.goals_for_b as number : row.goals_for_a as number,
          goalsAgainst: isA ? row.goals_against_b as number : row.goals_against_a as number,
          hits: isA ? row.hits_by_b as number : row.hits_by_a as number,
          blocks: isA ? row.blocks_by_b as number : row.blocks_by_a as number,
          penalties: isA ? row.penalties_by_b as number : row.penalties_by_a as number,
          faceoffWins: isA ? row.faceoff_wins_b as number : row.faceoff_wins_a as number,
        },
      };
    });

    // Also return opponent roster players with no versus data
    const matchupPlayerIds = new Set(matchups.map((m) => m.playerId));
    const rosterRows = await db.execute(sql`
      SELECT id, first_name, last_name, position, headshot_url, sweater_number
      FROM players
      WHERE current_team_id = ${teamId}
    `);

    const rosterArray = Array.isArray(rosterRows) ? rosterRows : (rosterRows as any).rows ?? [];
    const noHistory: MatchupPlayer[] = (rosterArray as any[])
      .filter((row: any) => row.id !== playerId && !matchupPlayerIds.has(row.id))
      .map((row: any) => ({
      playerId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      headshotUrl: row.headshot_url,
      sweaterNumber: row.sweater_number,
      gamesShared: 0,
      toiSharedSeconds: 0,
      rivalryScore: 0,
      stats: { points: 0, goals: 0, assists: 0, individualShots: 0, shotsFor: 0, shotsAgainst: 0, goalsFor: 0, goalsAgainst: 0, hits: 0, blocks: 0, penalties: 0, faceoffWins: 0 },
      oppStats: { points: 0, goals: 0, assists: 0, individualShots: 0, shotsFor: 0, shotsAgainst: 0, goalsFor: 0, goalsAgainst: 0, hits: 0, blocks: 0, penalties: 0, faceoffWins: 0 },
    }));

    return NextResponse.json({ matchups: [...matchups, ...noHistory] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Matchup API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
