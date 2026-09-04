import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, DERIVED } from "@/lib/api-cache";
import type { BioPlayer } from "@/types/versus";

interface Row {
  rank: number;
  targeting_score: number;
  lift_a: number;
  lift_b: number;
  hits_a_on_b: number;
  hits_b_on_a: number;
  games_shared: number;
  toi_shared_seconds: number;
  a_first_name: string; a_last_name: string; a_position: string | null;
  a_headshot_url: string | null; a_sweater_number: number | null;
  a_birth_date: string | null; a_team_abbrev: string | null;
  a_team_name: string | null; a_team_logo_url: string | null;
  b_first_name: string; b_last_name: string; b_position: string | null;
  b_headshot_url: string | null; b_sweater_number: number | null;
  b_birth_date: string | null; b_team_abbrev: string | null;
  b_team_name: string | null; b_team_logo_url: string | null;
  [key: string]: unknown;
}

export interface TargetingEntry {
  rank: number;
  playerA: BioPlayer;
  playerB: BioPlayer;
  /** The lower of the two lifts — both players must be targeting the other. */
  targetingScore: number;
  liftA: number;
  liftB: number;
  hitsAOnB: number;
  hitsBOnA: number;
  gamesShared: number;
  toiSharedSeconds: number;
}

/**
 * The targeting board: pairs who hit each other far more than they hit anyone
 * else, precomputed by `compute:versus`.
 *
 * `playerId` narrows it to one player's pairs. Ranks stay the board's own, so
 * a filtered list skips numbers — the rank is the pair's place in the league.
 *
 * GET /api/targeting?season={id|ALL}&gameType={regular|playoffs|both}
 *                   &playerId={id}&limit={n}
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
    const playerId = parseInt(params.get("playerId") ?? "", 10);
    const limit = Math.min(parseInt(params.get("limit") ?? "25", 10) || 25, 200);

    const playerFilter = !isNaN(playerId)
      ? sql`AND (e.player_a_id = ${playerId} OR e.player_b_id = ${playerId})`
      : sql``;

    const rows = await db.execute(sql`
      SELECT
        e.rank, e.targeting_score, e.lift_a, e.lift_b,
        e.hits_a_on_b, e.hits_b_on_a, e.games_shared, e.toi_shared_seconds,
        pa.first_name AS a_first_name, pa.last_name AS a_last_name,
        pa.position AS a_position, pa.headshot_url AS a_headshot_url,
        pa.sweater_number AS a_sweater_number, pa.birth_date AS a_birth_date,
        ta.abbrev AS a_team_abbrev, ta.name AS a_team_name,
        ta.logo_url AS a_team_logo_url,
        pb.first_name AS b_first_name, pb.last_name AS b_last_name,
        pb.position AS b_position, pb.headshot_url AS b_headshot_url,
        pb.sweater_number AS b_sweater_number, pb.birth_date AS b_birth_date,
        tb.abbrev AS b_team_abbrev, tb.name AS b_team_name,
        tb.logo_url AS b_team_logo_url
      FROM targeting_entries e
      JOIN players pa ON pa.id = e.player_a_id
      JOIN players pb ON pb.id = e.player_b_id
      LEFT JOIN teams ta ON ta.id = pa.current_team_id
      LEFT JOIN teams tb ON tb.id = pb.current_team_id
      WHERE e.season_scope = ${seasonScope}
        AND e.game_type_scope = ${gameTypeScope}
        ${playerFilter}
      ORDER BY e.rank
      LIMIT ${limit}
    `);

    const entries: TargetingEntry[] = unwrapRows<Row>(rows).map((r) => ({
      rank: r.rank,
      playerA: {
        firstName: r.a_first_name, lastName: r.a_last_name,
        position: r.a_position, headshotUrl: r.a_headshot_url,
        sweaterNumber: r.a_sweater_number, birthDate: r.a_birth_date,
        teamAbbrev: r.a_team_abbrev, teamName: r.a_team_name,
        teamLogoUrl: r.a_team_logo_url,
      },
      playerB: {
        firstName: r.b_first_name, lastName: r.b_last_name,
        position: r.b_position, headshotUrl: r.b_headshot_url,
        sweaterNumber: r.b_sweater_number, birthDate: r.b_birth_date,
        teamAbbrev: r.b_team_abbrev, teamName: r.b_team_name,
        teamLogoUrl: r.b_team_logo_url,
      },
      targetingScore: r.targeting_score,
      liftA: r.lift_a,
      liftB: r.lift_b,
      hitsAOnB: r.hits_a_on_b,
      hitsBOnA: r.hits_b_on_a,
      gamesShared: r.games_shared,
      toiSharedSeconds: r.toi_shared_seconds,
    }));

    return cachedJson({ entries }, DERIVED);
  } catch (err: unknown) {
    return apiError("Targeting API error", err);
  }
}
