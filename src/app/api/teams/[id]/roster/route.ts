import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, DERIVED } from "@/lib/api-cache";

interface TeamRow {
  id: number;
  abbrev: string;
  name: string;
  logo_url: string | null;
  [key: string]: unknown;
}

interface RosterRow {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  headshot_url: string | null;
  sweater_number: number | null;
  games_played: number;
  toi_seconds: number;
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  blocks: number;
  penalty_minutes: number;
  faceoff_wins: number;
  faceoff_losses: number;
  [key: string]: unknown;
}

export interface RosterPlayer {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  sweaterNumber: number | null;
  gamesPlayed: number;
  toiSeconds: number;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  hits: number;
  blocks: number;
  penaltyMinutes: number;
  faceoffWins: number;
  faceoffLosses: number;
}

export interface TeamRosterResponse {
  team: { id: number; abbrev: string; name: string; logoUrl: string | null };
  seasonScope: string;
  players: RosterPlayer[];
}

/**
 * A team's current roster with each player's totals **for this team**.
 *
 * The roster itself is `players.current_team_id`, so it is who is on the club
 * now. The stats are not that player's career: `player_season_totals` and
 * `player_season_stats` carry no team, so a player traded in last summer would
 * otherwise show his previous club's numbers on this page. `played_for` below
 * settles it from `shifts`, which does record a team, and limits the seasons
 * summed to the ones he actually played here.
 *
 * That extra join costs about 240ms cold, which the `DERIVED` policy pays at
 * most once an hour per team.
 *
 * GET /api/teams/{id}/roster?season={current|all}&gameType={regular|playoffs|both}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await context.params;
    const teamId = parseInt(resolved.id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
    }

    const seasonParam = request.nextUrl.searchParams.get("season") ?? "current";
    const gameTypeParam = request.nextUrl.searchParams.get("gameType") ?? "regular";

    const gameTypeWhere =
      gameTypeParam === "playoffs"
        ? sql`AND g.game_type = 3`
        : gameTypeParam === "both"
          ? sql`AND g.game_type IN (2, 3)`
          : sql`AND g.game_type = 2`;

    // "current" is the most recent season on record rather than a hardcoded id,
    // so it follows the data without a deploy when the season rolls over.
    const seasonWhere =
      seasonParam === "all"
        ? sql``
        : sql`AND g.season_id = (SELECT MAX(id) FROM seasons)`;

    const teamRows = await db.execute(sql`
      SELECT id, abbrev, name, logo_url FROM teams WHERE id = ${teamId}
    `);
    const team = unwrapRows<TeamRow>(teamRows)[0];
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const rows = await db.execute(sql`
      WITH roster AS (
        SELECT id FROM players WHERE current_team_id = ${teamId}
      ),
      played_for AS (
        SELECT DISTINCT s.player_id, g.season_id, g.game_type
        FROM shifts s
        JOIN games g ON g.id = s.game_id
        WHERE s.player_id IN (SELECT id FROM roster)
          AND s.team_id = ${teamId}
          ${gameTypeWhere}
          ${seasonWhere}
      )
      SELECT
        p.id, p.first_name, p.last_name, p.position,
        p.headshot_url, p.sweater_number,
        COALESCE(SUM(t.games_played), 0)::int  AS games_played,
        COALESCE(SUM(t.toi_seconds), 0)::int   AS toi_seconds,
        COALESCE(SUM(st.goals), 0)::int        AS goals,
        COALESCE(SUM(st.assists), 0)::int      AS assists,
        COALESCE(SUM(st.shots), 0)::int        AS shots,
        COALESCE(SUM(st.hits), 0)::int         AS hits,
        COALESCE(SUM(st.blocks), 0)::int       AS blocks,
        COALESCE(SUM(st.penalty_minutes), 0)::int AS penalty_minutes,
        COALESCE(SUM(st.faceoff_wins), 0)::int    AS faceoff_wins,
        COALESCE(SUM(st.faceoff_losses), 0)::int  AS faceoff_losses
      FROM roster r
      JOIN players p ON p.id = r.id
      JOIN played_for pf ON pf.player_id = r.id
      JOIN player_season_totals t
        ON t.player_id = r.id
       AND t.season_id = pf.season_id
       AND t.game_type = pf.game_type
      LEFT JOIN player_season_stats st
        ON st.player_id = r.id
       AND st.season_id = pf.season_id
       AND st.game_type = pf.game_type
      GROUP BY p.id, p.first_name, p.last_name, p.position,
               p.headshot_url, p.sweater_number
      ORDER BY toi_seconds DESC
    `);

    const players: RosterPlayer[] = unwrapRows<RosterRow>(rows).map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      position: r.position,
      headshotUrl: r.headshot_url,
      sweaterNumber: r.sweater_number,
      gamesPlayed: r.games_played,
      toiSeconds: r.toi_seconds,
      goals: r.goals,
      assists: r.assists,
      points: r.goals + r.assists,
      shots: r.shots,
      hits: r.hits,
      blocks: r.blocks,
      penaltyMinutes: r.penalty_minutes,
      faceoffWins: r.faceoff_wins,
      faceoffLosses: r.faceoff_losses,
    }));

    const response: TeamRosterResponse = {
      team: {
        id: team.id,
        abbrev: team.abbrev,
        name: team.name,
        logoUrl: team.logo_url,
      },
      seasonScope: seasonParam,
      players,
    };

    return cachedJson(response, DERIVED);
  } catch (err: unknown) {
    return apiError("Team roster API error", err);
  }
}
