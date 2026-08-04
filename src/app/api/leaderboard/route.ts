import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows, parseGameTypeFilter } from "@/lib/db-utils";

interface EntryRow {
  player_a_id: number;
  player_b_id: number;
  rivalry_score: number;
  games_shared: number;
  toi_shared_seconds: number;
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

/**
 * Reads a precomputed ranking from `leaderboard_entries`.
 *
 * `npm run compute:versus` builds that table. Player and team details join
 * here rather than at build time, so a trade shows up without a rebuild.
 *
 * GET /api/leaderboard?season={id}&gameType={regular|playoffs|both}&limit={n}
 * Omit `season` for every season combined.
 */
export async function GET(request: NextRequest) {
  try {
    const seasonScope = request.nextUrl.searchParams.get("season") ?? "ALL";
    const gameTypeScope = parseGameTypeFilter(
      request.nextUrl.searchParams.get("gameType")
    );
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
      200
    );

    const rows = await db.execute(sql`
      SELECT
        e.player_a_id,
        e.player_b_id,
        e.rivalry_score,
        e.games_shared,
        e.toi_shared_seconds,
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
      FROM leaderboard_entries e
      JOIN players pa ON pa.id = e.player_a_id
      JOIN players pb ON pb.id = e.player_b_id
      LEFT JOIN teams ta ON ta.id = pa.current_team_id
      LEFT JOIN teams tb ON tb.id = pb.current_team_id
      WHERE e.season_scope = ${seasonScope}
        AND e.game_type_scope = ${gameTypeScope}
      ORDER BY e.rank
      LIMIT ${limit}
    `);

    const leaderboard: LeaderboardEntry[] = unwrapRows<EntryRow>(rows).map((row) => ({
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
      rivalryScore: row.rivalry_score,
      gamesShared: row.games_shared,
      toiSharedSeconds: row.toi_shared_seconds,
    }));

    return NextResponse.json({ leaderboard });
  } catch (err: unknown) {
    console.error("Leaderboard API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
