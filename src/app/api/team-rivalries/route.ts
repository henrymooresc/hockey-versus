import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, DERIVED } from "@/lib/api-cache";

interface Row {
  rank: number;
  rivalry_score: number;
  games_played: number;
  goals: number;
  hits: number;
  penalty_minutes: number;
  x_id: number;
  x_abbrev: string;
  x_name: string;
  x_logo_url: string | null;
  y_id: number;
  y_abbrev: string;
  y_name: string;
  y_logo_url: string | null;
  [key: string]: unknown;
}

export interface TeamRivalryTeam {
  id: number;
  abbrev: string;
  name: string;
  logoUrl: string | null;
}

export interface TeamRivalryEntry {
  rank: number;
  teamX: TeamRivalryTeam;
  teamY: TeamRivalryTeam;
  rivalryScore: number;
  gamesPlayed: number;
  goals: number;
  hits: number;
  penaltyMinutes: number;
}

/**
 * The team-against-team board, precomputed by `compute:versus`.
 *
 * `teamId` narrows it to one club's matchups, which is what a team page shows;
 * without it the response is the league board. Ranks are always the board's
 * own, so a filtered list reads 1, 4, 17 rather than renumbering — the number
 * means "this matchup's place in the league", not its place in the list.
 *
 * Scores are weighted volume per pair per game, the same scale as the player
 * Rivalry Score, so the two boards can be read against each other.
 *
 * GET /api/team-rivalries?season={id|ALL}&gameType={regular|playoffs|both}
 *                        &teamId={id}&limit={n}
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const seasonScope = params.get("season") ?? "ALL";
    const gameTypeParam = params.get("gameType");
    const gameTypeScope =
      gameTypeParam === "playoffs" || gameTypeParam === "both"
        ? gameTypeParam
        : "regular";
    const teamId = parseInt(params.get("teamId") ?? "", 10);
    const limit = Math.min(
      parseInt(params.get("limit") ?? "25", 10) || 25,
      100
    );

    const teamFilter = !isNaN(teamId)
      ? sql`AND (e.team_x_id = ${teamId} OR e.team_y_id = ${teamId})`
      : sql``;

    const rows = await db.execute(sql`
      SELECT
        e.rank, e.rivalry_score, e.games_played,
        e.goals, e.hits, e.penalty_minutes,
        tx.id AS x_id, tx.abbrev AS x_abbrev, tx.name AS x_name,
        tx.logo_url AS x_logo_url,
        ty.id AS y_id, ty.abbrev AS y_abbrev, ty.name AS y_name,
        ty.logo_url AS y_logo_url
      FROM team_rivalry_entries e
      JOIN teams tx ON tx.id = e.team_x_id
      JOIN teams ty ON ty.id = e.team_y_id
      WHERE e.season_scope = ${seasonScope}
        AND e.game_type_scope = ${gameTypeScope}
        ${teamFilter}
      ORDER BY e.rank
      LIMIT ${limit}
    `);

    const entries: TeamRivalryEntry[] = unwrapRows<Row>(rows).map((r) => ({
      rank: r.rank,
      teamX: { id: r.x_id, abbrev: r.x_abbrev, name: r.x_name, logoUrl: r.x_logo_url },
      teamY: { id: r.y_id, abbrev: r.y_abbrev, name: r.y_name, logoUrl: r.y_logo_url },
      rivalryScore: r.rivalry_score,
      gamesPlayed: r.games_played,
      goals: r.goals,
      hits: r.hits,
      penaltyMinutes: r.penalty_minutes,
    }));

    return cachedJson({ entries }, DERIVED);
  } catch (err: unknown) {
    return apiError("Team rivalries API error", err);
  }
}
