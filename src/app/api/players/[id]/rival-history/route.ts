import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import {
  computeSkaterRivalryScore,
  computeGoalieRivalryScore,
} from "@/lib/rivalry-score";
import {
  mergeIntervals,
  computeShiftOverlaps,
  isTimeInIntervals,
  type Interval,
} from "@/lib/time-utils";
import type { RivalGameHistory } from "@/types/versus";

interface ShiftRow {
  game_id: number;
  player_id: number;
  team_id: number;
  period: number;
  start_seconds: number;
  end_seconds: number;
}

interface EventRow {
  game_id: number;
  event_type: string;
  period: number;
  time_seconds: number;
  team_id: number | null;
  player1_id: number | null;
  player2_id: number | null;
  player3_id: number | null;
}

interface GameInfo {
  game_id: number;
  season_id: string;
  game_date: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
}

/**
 * Returns per-game rivalry scores for a specific player pair.
 * Computes from raw shifts + game_events tables.
 * GET /api/players/{id}/rival-history?opponentId={opponentId}
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const playerId = parseInt(resolvedParams.id, 10);
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

    // Canonicalize: lower ID = playerA
    const playerAId = Math.min(playerId, opponentId);
    const playerBId = Math.max(playerId, opponentId);
    const isRequestingA = playerId === playerAId;

    // Get opponent position to determine rivalry score type
    const playerRows = await db.execute(sql`
      SELECT position FROM players WHERE id = ${opponentId}
    `);
    const isGoalie = unwrapRows<{ position: string | null }>(playerRows)[0]?.position === "G";

    // 1. Find all games across all seasons where both players have shifts on opposing teams
    const gameRows = await db.execute(sql`
      SELECT DISTINCT g.id AS game_id, g.season_id, g.game_date,
             g.home_team_id, g.away_team_id,
             g.home_score, g.away_score
      FROM games g
      JOIN shifts s1 ON s1.game_id = g.id AND s1.player_id = ${playerAId}
      JOIN shifts s2 ON s2.game_id = g.id AND s2.player_id = ${playerBId}
      WHERE (
        (s1.team_id = g.home_team_id AND s2.team_id = g.away_team_id)
        OR (s1.team_id = g.away_team_id AND s2.team_id = g.home_team_id)
      )
      ORDER BY g.game_date ASC
    `);
    const gamesArray = unwrapRows<GameInfo>(gameRows);

    if (gamesArray.length === 0) {
      return NextResponse.json({ games: [] });
    }

    const gameIds = gamesArray.map((g) => g.game_id);
    const gameMap = new Map(gamesArray.map((g) => [g.game_id, g]));

    // Build a SQL-safe list for IN clauses
    const gameIdList = sql.join(gameIds.map((id) => sql`${id}`), sql`, `);

    // 2. Bulk load shifts for both players across all shared games
    const shiftsResult = await db.execute(sql`
      SELECT game_id, player_id, team_id, period, start_seconds, end_seconds
      FROM shifts
      WHERE game_id IN (${gameIdList})
        AND player_id IN (${playerAId}, ${playerBId})
      ORDER BY game_id, period, start_seconds
    `);
    const shiftsArray = unwrapRows<ShiftRow>(shiftsResult);

    // 3. Bulk load relevant events across all shared games
    const eventsResult = await db.execute(sql`
      SELECT game_id, event_type, period, time_seconds,
             team_id, player1_id, player2_id, player3_id
      FROM game_events
      WHERE game_id IN (${gameIdList})
        AND event_type IN ('goal', 'shot', 'missed_shot', 'blocked_shot',
                           'hit', 'penalty', 'faceoff')
      ORDER BY game_id, period, time_seconds
    `);
    const eventsArray = unwrapRows<EventRow>(eventsResult);

    // Group shifts and events by game
    const shiftsByGame = new Map<number, ShiftRow[]>();
    for (const s of shiftsArray) {
      if (!shiftsByGame.has(s.game_id)) shiftsByGame.set(s.game_id, []);
      shiftsByGame.get(s.game_id)!.push(s);
    }

    const eventsByGame = new Map<number, EventRow[]>();
    for (const e of eventsArray) {
      if (!eventsByGame.has(e.game_id)) eventsByGame.set(e.game_id, []);
      eventsByGame.get(e.game_id)!.push(e);
    }

    // 4. Compute per-game rivalry scores
    const results: RivalGameHistory[] = [];

    for (const gameId of gameIds) {
      const gameShifts = shiftsByGame.get(gameId) ?? [];
      const gameEvents = eventsByGame.get(gameId) ?? [];
      const gameInfo = gameMap.get(gameId)!;

      const shiftsA = gameShifts.filter((s) => s.player_id === playerAId);
      const shiftsB = gameShifts.filter((s) => s.player_id === playerBId);

      if (shiftsA.length === 0 || shiftsB.length === 0) continue;

      const teamA = shiftsA[0].team_id;
      const teamB = shiftsB[0].team_id;

      // Compute overlap per period
      const periods = new Set([
        ...shiftsA.map((s) => s.period),
        ...shiftsB.map((s) => s.period),
      ]);

      let totalOverlap = 0;
      const allOverlapIntervals = new Map<number, Interval[]>();

      for (const period of periods) {
        const pShiftsA = mergeIntervals(
          shiftsA
            .filter((s) => s.period === period)
            .map((s) => ({ start: s.start_seconds, end: s.end_seconds }))
        );
        const pShiftsB = mergeIntervals(
          shiftsB
            .filter((s) => s.period === period)
            .map((s) => ({ start: s.start_seconds, end: s.end_seconds }))
        );

        if (pShiftsA.length === 0 || pShiftsB.length === 0) continue;

        const { totalSeconds, intervals } = computeShiftOverlaps(
          pShiftsA,
          pShiftsB
        );
        totalOverlap += totalSeconds;
        if (intervals.length > 0) {
          allOverlapIntervals.set(period, intervals);
        }
      }

      if (totalOverlap === 0) continue;

      // Attribute events during overlap
      let hitsByA = 0,
        hitsByB = 0;
      let blocksByA = 0,
        blocksByB = 0;
      let penaltiesByA = 0,
        penaltiesByB = 0;
      let faceoffWinsA = 0,
        faceoffWinsB = 0;
      let playerAGoals = 0,
        playerAAssists = 0,
        playerAShots = 0;
      let playerBGoals = 0,
        playerBAssists = 0,
        playerBShots = 0;

      for (const event of gameEvents) {
        const periodIntervals = allOverlapIntervals.get(event.period);
        if (!periodIntervals) continue;
        if (!isTimeInIntervals(event.time_seconds, periodIntervals)) continue;

        switch (event.event_type) {
          case "goal": {
            if (event.player1_id === playerAId) {
              playerAGoals++;
              playerAShots++;
            }
            if (event.player1_id === playerBId) {
              playerBGoals++;
              playerBShots++;
            }
            if (
              event.player2_id === playerAId ||
              event.player3_id === playerAId
            )
              playerAAssists++;
            if (
              event.player2_id === playerBId ||
              event.player3_id === playerBId
            )
              playerBAssists++;
            break;
          }
          case "shot":
          case "missed_shot":
          case "blocked_shot": {
            if (event.player1_id === playerAId) playerAShots++;
            if (event.player1_id === playerBId) playerBShots++;
            if (event.event_type === "blocked_shot") {
              if (event.player2_id === playerAId) blocksByA++;
              if (event.player2_id === playerBId) blocksByB++;
            }
            break;
          }
          case "hit": {
            if (
              event.player1_id === playerAId &&
              event.player2_id === playerBId
            )
              hitsByA++;
            if (
              event.player1_id === playerBId &&
              event.player2_id === playerAId
            )
              hitsByB++;
            break;
          }
          case "penalty": {
            if (
              event.player1_id === playerAId &&
              event.player2_id === playerBId
            )
              penaltiesByA++;
            if (
              event.player1_id === playerBId &&
              event.player2_id === playerAId
            )
              penaltiesByB++;
            break;
          }
          case "faceoff": {
            if (
              event.player1_id === playerAId &&
              event.player2_id === playerBId
            )
              faceoffWinsA++;
            if (
              event.player1_id === playerBId &&
              event.player2_id === playerAId
            )
              faceoffWinsB++;
            break;
          }
        }
      }

      // Determine wins from game score
      let winsPlayer = 0,
        winsOpponent = 0;
      if (gameInfo.home_score != null && gameInfo.away_score != null) {
        const playerTeamId = isRequestingA ? teamA : teamB;
        const isPlayerHome = playerTeamId === gameInfo.home_team_id;
        const playerScore = isPlayerHome
          ? gameInfo.home_score
          : gameInfo.away_score;
        const oppScore = isPlayerHome
          ? gameInfo.away_score
          : gameInfo.home_score;
        if (playerScore > oppScore) winsPlayer = 1;
        else if (oppScore > playerScore) winsOpponent = 1;
      }

      // Map stats to the requesting player's perspective
      const pShots = isRequestingA ? playerAShots : playerBShots;
      const pGoals = isRequestingA ? playerAGoals : playerBGoals;
      const pAssists = isRequestingA ? playerAAssists : playerBAssists;
      const oShots = isRequestingA ? playerBShots : playerAShots;
      const oGoals = isRequestingA ? playerBGoals : playerAGoals;
      const oAssists = isRequestingA ? playerBAssists : playerAAssists;

      const rivalryScore = isGoalie
        ? computeGoalieRivalryScore({
            toiSharedSeconds: totalOverlap,
            skaterShots: pShots,
            skaterGoals: pGoals,
            winsA: winsPlayer,
            winsB: winsOpponent,
          })
        : computeSkaterRivalryScore({
            toiSharedSeconds: totalOverlap,
            gamesShared: 1,
            hitsByA: isRequestingA ? hitsByA : hitsByB,
            hitsByB: isRequestingA ? hitsByB : hitsByA,
            blocksByA: isRequestingA ? blocksByA : blocksByB,
            blocksByB: isRequestingA ? blocksByB : blocksByA,
            penaltiesByA: isRequestingA ? penaltiesByA : penaltiesByB,
            penaltiesByB: isRequestingA ? penaltiesByB : penaltiesByA,
            faceoffWinsA: isRequestingA ? faceoffWinsA : faceoffWinsB,
            faceoffWinsB: isRequestingA ? faceoffWinsB : faceoffWinsA,
            playerAGoals: pGoals,
            playerAAssists: pAssists,
            playerAShots: pShots,
            playerBGoals: oGoals,
            playerBAssists: oAssists,
            playerBShots: oShots,
            winsA: winsPlayer,
            winsB: winsOpponent,
          });

      // Format date label as "Mon DD"
      const d = new Date(gameInfo.game_date + "T00:00:00");
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      results.push({
        gameId: gameId,
        gameDate: gameInfo.game_date,
        seasonId: gameInfo.season_id,
        label,
        rivalryScore: Math.round(rivalryScore * 100) / 100,
        toiSharedSeconds: totalOverlap,
      });
    }

    return NextResponse.json({ games: results });
  } catch (err) {
    console.error("Rival history API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
