import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, DERIVED } from "@/lib/api-cache";

interface SharedGameRow {
  game_id: number;
  a_team: number;
  b_team: number;
  [key: string]: unknown;
}

interface GameDateRow {
  id: number;
  game_date: string;
  [key: string]: unknown;
}

interface TeamRow {
  id: number;
  abbrev: string | null;
  name: string | null;
  logo_url: string | null;
  [key: string]: unknown;
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

    // Deliberately three small queries rather than one joined statement.
    //
    // As one statement the planner estimated the shared-games set at 1.6M rows
    // when the real answer is nearer 20, and sized every join for that. It then
    // merge-joined the whole `games` table, and the route took 700-900ms. The
    // estimate is unfixable from here: it comes from not knowing how many
    // distinct games one player appears in.
    //
    // Split up, each query has only one sensible plan. Together they run in a
    // few milliseconds, and the grouping below is trivial at this size.

    // 1. Games where both players skated, on opposing teams. Covered entirely
    //    by idx_shifts_player_game (player_id, game_id, team_id).
    const sharedRows = await db.execute(sql`
      WITH a_games AS (
        SELECT DISTINCT game_id, team_id FROM shifts WHERE player_id = ${playerAId}
      ),
      b_games AS (
        SELECT DISTINCT game_id, team_id FROM shifts WHERE player_id = ${playerBId}
      )
      SELECT a.game_id, a.team_id AS a_team, b.team_id AS b_team
      FROM a_games a
      JOIN b_games b ON b.game_id = a.game_id
      WHERE a.team_id <> b.team_id
    `);
    const shared = unwrapRows<SharedGameRow>(sharedRows);

    if (shared.length === 0) {
      return cachedJson(
        {
          playerA: { id: playerAId, teams: [] },
          playerB: { id: playerBId, teams: [] },
        } satisfies TeamHistoryResponse,
        DERIVED
      );
    }

    // 2. Dates for exactly those games, and 3. the teams involved.
    const gameIds = shared.map((r) => r.game_id);
    const teamIds = Array.from(
      new Set(shared.flatMap((r) => [r.a_team, r.b_team]))
    );

    const [dateRows, teamRows] = await Promise.all([
      db.execute(sql`
        SELECT id, game_date::text AS game_date FROM games
        WHERE id IN (${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)})
      `),
      db.execute(sql`
        SELECT id, abbrev, name, logo_url FROM teams
        WHERE id IN (${sql.join(teamIds.map((id) => sql`${id}`), sql`, `)})
      `),
    ]);

    const dateOf = new Map(
      unwrapRows<GameDateRow>(dateRows).map((r) => [r.id, r.game_date])
    );
    const teamOf = new Map(
      unwrapRows<TeamRow>(teamRows).map((r) => [r.id, r])
    );

    // Fold into one stint per (player, team): first date, last date, games.
    const stints = new Map<
      string,
      { playerId: number; teamId: number; first: string; last: string; games: Set<number> }
    >();

    const record = (playerIdForRow: number, teamId: number, gameId: number) => {
      const date = dateOf.get(gameId);
      if (!date) return;
      const key = `${playerIdForRow}-${teamId}`;
      const existing = stints.get(key);
      if (!existing) {
        stints.set(key, {
          playerId: playerIdForRow,
          teamId,
          first: date,
          last: date,
          games: new Set([gameId]),
        });
        return;
      }
      if (date < existing.first) existing.first = date;
      if (date > existing.last) existing.last = date;
      existing.games.add(gameId);
    };

    for (const row of shared) {
      record(playerAId, row.a_team, row.game_id);
      record(playerBId, row.b_team, row.game_id);
    }

    const aTeams: TeamHistoryStint[] = [];
    const bTeams: TeamHistoryStint[] = [];

    for (const s of Array.from(stints.values()).sort(
      (x, y) => x.playerId - y.playerId || x.first.localeCompare(y.first)
    )) {
      const team = teamOf.get(s.teamId);
      const stint: TeamHistoryStint = {
        teamId: s.teamId,
        abbrev: team?.abbrev ?? null,
        name: team?.name ?? null,
        logoUrl: team?.logo_url ?? null,
        firstDate: s.first,
        lastDate: s.last,
        gameCount: s.games.size,
      };
      if (s.playerId === playerAId) aTeams.push(stint);
      else bTeams.push(stint);
    }

    const response: TeamHistoryResponse = {
      playerA: { id: playerAId, teams: aTeams },
      playerB: { id: playerBId, teams: bTeams },
    };
    return cachedJson(response, DERIVED);
  } catch (err: unknown) {
    return apiError("Team history API error", err);
  }
}
