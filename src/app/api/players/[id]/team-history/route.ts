import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";

interface Row {
  player_id: number;
  team_id: number;
  team_abbrev: string | null;
  team_name: string | null;
  team_logo_url: string | null;
  first_date: string;
  last_date: string;
  game_count: number;
}

export interface TeamHistoryStint {
  teamId: number;
  abbrev: string | null;
  name: string | null;
  logoUrl: string | null;
  firstDate: string;
  lastDate: string;
  gameCount: number;
}

export interface TeamHistoryResponse {
  playerA: { id: number; teams: TeamHistoryStint[] };
  playerB: { id: number; teams: TeamHistoryStint[] };
}

/**
 * For a pair of players, returns the chronological list of teams each player
 * was on during the games where they shared ice on opposing sides.
 *
 * GET /api/players/{id}/team-history?opponentId={opponentId}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(context.params);
    const playerId = parseInt(resolved.id, 10);
    const opponentId = parseInt(
      request.nextUrl.searchParams.get("opponentId") ?? "",
      10
    );
    if (isNaN(playerId) || isNaN(opponentId)) {
      return NextResponse.json(
        { error: "Invalid player or opponent ID" },
        { status: 400 }
      );
    }

    const playerAId = Math.min(playerId, opponentId);
    const playerBId = Math.max(playerId, opponentId);

    // Per (player, team), aggregate first/last game dates and count of shared games
    // where the two players were on opposing sides.
    const rows = await db.execute(sql`
      WITH shared_games AS (
        SELECT g.id, g.game_date
        FROM games g
        WHERE EXISTS (
          SELECT 1 FROM shifts s1
          WHERE s1.game_id = g.id AND s1.player_id = ${playerAId}
            AND s1.team_id = g.home_team_id
        )
        AND EXISTS (
          SELECT 1 FROM shifts s2
          WHERE s2.game_id = g.id AND s2.player_id = ${playerBId}
            AND s2.team_id = g.away_team_id
        )
        UNION
        SELECT g.id, g.game_date
        FROM games g
        WHERE EXISTS (
          SELECT 1 FROM shifts s1
          WHERE s1.game_id = g.id AND s1.player_id = ${playerAId}
            AND s1.team_id = g.away_team_id
        )
        AND EXISTS (
          SELECT 1 FROM shifts s2
          WHERE s2.game_id = g.id AND s2.player_id = ${playerBId}
            AND s2.team_id = g.home_team_id
        )
      )
      SELECT
        s.player_id,
        s.team_id,
        t.abbrev AS team_abbrev,
        t.name AS team_name,
        t.logo_url AS team_logo_url,
        MIN(g.game_date)::text AS first_date,
        MAX(g.game_date)::text AS last_date,
        COUNT(DISTINCT g.id)::int AS game_count
      FROM shifts s
      JOIN shared_games g ON g.id = s.game_id
      LEFT JOIN teams t ON t.id = s.team_id
      WHERE s.player_id IN (${playerAId}, ${playerBId})
      GROUP BY s.player_id, s.team_id, t.abbrev, t.name, t.logo_url
      ORDER BY s.player_id, MIN(g.game_date) ASC
    `);

    const data = unwrapRows<Row>(rows);
    const aTeams: TeamHistoryStint[] = [];
    const bTeams: TeamHistoryStint[] = [];

    for (const r of data) {
      const stint: TeamHistoryStint = {
        teamId: r.team_id,
        abbrev: r.team_abbrev,
        name: r.team_name,
        logoUrl: r.team_logo_url,
        firstDate: r.first_date,
        lastDate: r.last_date,
        gameCount: r.game_count,
      };
      if (r.player_id === playerAId) aTeams.push(stint);
      else if (r.player_id === playerBId) bTeams.push(stint);
    }

    const response: TeamHistoryResponse = {
      playerA: { id: playerAId, teams: aTeams },
      playerB: { id: playerBId, teams: bTeams },
    };
    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Team history API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
