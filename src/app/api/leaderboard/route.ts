import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows, parseGameTypeFilter, gameTypeClause } from "@/lib/db-utils";
import { computeSkaterRivalryScore, computeGoalieRivalryScore } from "@/lib/rivalry-score";

interface PairRow {
  player_a_id: number;
  player_b_id: number;
  toi_shared_seconds: number;
  games_shared: number;
  player_a_goals: number;
  player_a_assists: number;
  player_a_shots: number;
  player_b_goals: number;
  player_b_assists: number;
  player_b_shots: number;
  hits_by_a: number;
  hits_by_b: number;
  blocks_by_a: number;
  blocks_by_b: number;
  penalties_by_a: number;
  penalties_by_b: number;
  faceoff_wins_a: number;
  faceoff_wins_b: number;
  wins_a: number;
  wins_b: number;
  a_first_name: string;
  a_last_name: string;
  a_position: string | null;
  a_headshot_url: string | null;
  a_team_abbrev: string | null;
  a_team_name: string | null;
  a_team_logo_url: string | null;
  b_first_name: string;
  b_last_name: string;
  b_position: string | null;
  b_headshot_url: string | null;
  b_team_abbrev: string | null;
  b_team_name: string | null;
  b_team_logo_url: string | null;
  [key: string]: unknown;
}

export interface LeaderboardEntry {
  playerA: {
    id: number;
    firstName: string;
    lastName: string;
    position: string | null;
    headshotUrl: string | null;
    teamAbbrev: string | null;
    teamName: string | null;
    teamLogoUrl: string | null;
  };
  playerB: {
    id: number;
    firstName: string;
    lastName: string;
    position: string | null;
    headshotUrl: string | null;
    teamAbbrev: string | null;
    teamName: string | null;
    teamLogoUrl: string | null;
  };
  rivalryScore: number;
  gamesShared: number;
  toiSharedSeconds: number;
}

export async function GET(request: NextRequest) {
  try {
    const seasonsParam = request.nextUrl.searchParams.get("seasons");
    const seasonFilter = seasonsParam ? seasonsParam.split(",").filter(Boolean) : null;
    const gtFilter = parseGameTypeFilter(request.nextUrl.searchParams.get("gameType"));
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
      200
    );
    // Score every pair above the noise floor, then rank by rivalry score.
    // (Pre-filtering by TOI rank is wrong: the score is per-game, so
    // high-intensity, low-TOI pairs can outscore high-TOI ones.)
    const minToi = 1800; // 30 minutes shared ice — filters noise

    const rows = await db.execute(sql`
      WITH aggregated AS (
        SELECT
          player_a_id,
          player_b_id,
          SUM(toi_shared_seconds)::int AS toi_shared_seconds,
          SUM(games_shared)::int AS games_shared,
          SUM(player_a_goals)::int AS player_a_goals,
          SUM(player_a_assists)::int AS player_a_assists,
          SUM(player_a_shots)::int AS player_a_shots,
          SUM(player_b_goals)::int AS player_b_goals,
          SUM(player_b_assists)::int AS player_b_assists,
          SUM(player_b_shots)::int AS player_b_shots,
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
        WHERE same_team = false
          AND toi_shared_seconds > 0
          ${seasonFilter ? sql`AND season_id IN (${sql.join(seasonFilter.map((s) => sql`${s}`), sql`, `)})` : sql``}
          ${gameTypeClause(gtFilter)}
        GROUP BY player_a_id, player_b_id
        HAVING SUM(toi_shared_seconds) >= ${minToi}
      )
      SELECT
        a.*,
        pa.first_name AS a_first_name,
        pa.last_name AS a_last_name,
        pa.position AS a_position,
        pa.headshot_url AS a_headshot_url,
        ta.abbrev AS a_team_abbrev,
        ta.name AS a_team_name,
        ta.logo_url AS a_team_logo_url,
        pb.first_name AS b_first_name,
        pb.last_name AS b_last_name,
        pb.position AS b_position,
        pb.headshot_url AS b_headshot_url,
        tb.abbrev AS b_team_abbrev,
        tb.name AS b_team_name,
        tb.logo_url AS b_team_logo_url
      FROM aggregated a
      JOIN players pa ON pa.id = a.player_a_id
      JOIN players pb ON pb.id = a.player_b_id
      LEFT JOIN teams ta ON ta.id = pa.current_team_id
      LEFT JOIN teams tb ON tb.id = pb.current_team_id
    `);

    const pairs = unwrapRows<PairRow>(rows);

    const scored: LeaderboardEntry[] = pairs.map((row) => {
      const aIsGoalie = row.a_position === "G";
      const bIsGoalie = row.b_position === "G";

      let rivalryScore: number;
      if (aIsGoalie && !bIsGoalie) {
        // Skater (B) shooting on Goalie (A)
        rivalryScore = computeGoalieRivalryScore({
          toiSharedSeconds: row.toi_shared_seconds,
          gamesShared: row.games_shared,
          skaterShots: row.player_b_shots,
          skaterGoals: row.player_b_goals,
          skaterAssists: row.player_b_assists,
          winsA: row.wins_a,
          winsB: row.wins_b,
        });
      } else if (bIsGoalie && !aIsGoalie) {
        rivalryScore = computeGoalieRivalryScore({
          toiSharedSeconds: row.toi_shared_seconds,
          gamesShared: row.games_shared,
          skaterShots: row.player_a_shots,
          skaterGoals: row.player_a_goals,
          skaterAssists: row.player_a_assists,
          winsA: row.wins_a,
          winsB: row.wins_b,
        });
      } else if (aIsGoalie && bIsGoalie) {
        // Goalie vs goalie — no meaningful rivalry score
        rivalryScore = 0;
      } else {
        rivalryScore = computeSkaterRivalryScore({
          toiSharedSeconds: row.toi_shared_seconds,
          gamesShared: row.games_shared,
          hitsByA: row.hits_by_a,
          hitsByB: row.hits_by_b,
          blocksByA: row.blocks_by_a,
          blocksByB: row.blocks_by_b,
          penaltiesByA: row.penalties_by_a,
          penaltiesByB: row.penalties_by_b,
          faceoffWinsA: row.faceoff_wins_a,
          faceoffWinsB: row.faceoff_wins_b,
          playerAGoals: row.player_a_goals,
          playerAAssists: row.player_a_assists,
          playerAShots: row.player_a_shots,
          playerBGoals: row.player_b_goals,
          playerBAssists: row.player_b_assists,
          playerBShots: row.player_b_shots,
          winsA: row.wins_a,
          winsB: row.wins_b,
        });
      }

      return {
        playerA: {
          id: row.player_a_id,
          firstName: row.a_first_name,
          lastName: row.a_last_name,
          position: row.a_position,
          headshotUrl: row.a_headshot_url,
          teamAbbrev: row.a_team_abbrev,
          teamName: row.a_team_name,
          teamLogoUrl: row.a_team_logo_url,
        },
        playerB: {
          id: row.player_b_id,
          firstName: row.b_first_name,
          lastName: row.b_last_name,
          position: row.b_position,
          headshotUrl: row.b_headshot_url,
          teamAbbrev: row.b_team_abbrev,
          teamName: row.b_team_name,
          teamLogoUrl: row.b_team_logo_url,
        },
        rivalryScore,
        gamesShared: row.games_shared,
        toiSharedSeconds: row.toi_shared_seconds,
      };
    });

    scored.sort((a, b) => b.rivalryScore - a.rivalryScore);

    return NextResponse.json({ leaderboard: scored.slice(0, limit) });
  } catch (err: unknown) {
    console.error("Leaderboard API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
