import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, DERIVED } from "@/lib/api-cache";
import {
  computeGameVersus,
  type ShiftRecord,
  type EventRecord,
  type PairStats,
} from "@/lib/versus-engine";
import {
  computeSkaterRivalryScore,
  computeGoalieRivalryScore,
} from "@/lib/rivalry-score";

interface GameRow {
  id: number;
  season_id: string;
  game_date: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  home_abbrev: string | null;
  home_name: string | null;
  home_logo_url: string | null;
  away_abbrev: string | null;
  away_name: string | null;
  away_logo_url: string | null;
}

interface ShiftRow {
  player_id: number;
  team_id: number;
  period: number;
  start_seconds: number;
  end_seconds: number;
}

interface EventRow {
  event_type: string;
  period: number;
  time_seconds: number;
  team_id: number | null;
  player1_id: number | null;
  player2_id: number | null;
  player3_id: number | null;
  penalty_minutes: number | null;
}

interface PlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  headshot_url: string | null;
  current_team_id: number | null;
}

interface CareerRow {
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
  penalty_minutes_a: number;
  penalty_minutes_b: number;
  faceoff_wins_a: number;
  faceoff_wins_b: number;
  wins_a: number;
  wins_b: number;
}

interface PerspectiveStats {
  goals: number;
  assists: number;
  shots: number;
  hits: number;
  blocks: number;
  penalties: number;
  faceoffWins: number;
}

function statsFromPair(stats: PairStats, side: "A" | "B"): PerspectiveStats {
  if (side === "A") {
    return {
      goals: stats.playerAGoals,
      assists: stats.playerAAssists,
      shots: stats.playerAShots,
      hits: stats.hitsByA,
      blocks: stats.blocksByA,
      penalties: stats.penaltyMinutesA,
      faceoffWins: stats.faceoffWinsA,
    };
  }
  return {
    goals: stats.playerBGoals,
    assists: stats.playerBAssists,
    shots: stats.playerBShots,
    hits: stats.hitsByB,
    blocks: stats.blocksByB,
    penalties: stats.penaltyMinutesB,
    faceoffWins: stats.faceoffWinsB,
  };
}

function rivalryFromPair(
  stats: PairStats,
  isGoalieMatchup: boolean,
  goalieIsA: boolean,
  winsA: number,
  winsB: number,
  gamesShared: number
): number {
  if (isGoalieMatchup) {
    const skaterShots = goalieIsA ? stats.playerBShots : stats.playerAShots;
    const skaterGoals = goalieIsA ? stats.playerBGoals : stats.playerAGoals;
    const skaterAssists = goalieIsA ? stats.playerBAssists : stats.playerAAssists;
    return computeGoalieRivalryScore({
      toiSharedSeconds: stats.toiSharedSeconds,
      gamesShared,
      skaterShots,
      skaterGoals,
      skaterAssists,
      winsA,
      winsB,
    });
  }
  return computeSkaterRivalryScore({
    toiSharedSeconds: stats.toiSharedSeconds,
    gamesShared,
    hitsByA: stats.hitsByA,
    hitsByB: stats.hitsByB,
    blocksByA: stats.blocksByA,
    blocksByB: stats.blocksByB,
    penaltyMinutesA: stats.penaltyMinutesA,
    penaltyMinutesB: stats.penaltyMinutesB,
    faceoffWinsA: stats.faceoffWinsA,
    faceoffWinsB: stats.faceoffWinsB,
    playerAGoals: stats.playerAGoals,
    playerAAssists: stats.playerAAssists,
    playerAShots: stats.playerAShots,
    playerBGoals: stats.playerBGoals,
    playerBAssists: stats.playerBAssists,
    playerBShots: stats.playerBShots,
    winsA,
    winsB,
  });
}

const MIN_SHARED_SECONDS = 60; // ignore noise pairs with < 1min shared ice

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(context.params);
    const gameId = parseInt(resolved.id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    // Game info
    const gameRows = await db.execute(sql`
      SELECT g.id, g.season_id, g.game_date, g.home_team_id, g.away_team_id,
             g.home_score, g.away_score,
             ht.abbrev AS home_abbrev, ht.name AS home_name, ht.logo_url AS home_logo_url,
             at.abbrev AS away_abbrev, at.name AS away_name, at.logo_url AS away_logo_url
      FROM games g
      LEFT JOIN teams ht ON ht.id = g.home_team_id
      LEFT JOIN teams at ON at.id = g.away_team_id
      WHERE g.id = ${gameId}
    `);
    const game = unwrapRows<GameRow>(gameRows)[0];
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Determine win allocation based on final score
    const homeWon = game.home_score != null && game.away_score != null
      ? game.home_score > game.away_score
      : null;
    const awayWon = game.home_score != null && game.away_score != null
      ? game.away_score > game.home_score
      : null;

    // Shifts + events for this game
    const [shiftsRes, eventsRes] = await Promise.all([
      db.execute(sql`
        SELECT player_id, team_id, period, start_seconds, end_seconds
        FROM shifts WHERE game_id = ${gameId}
      `),
      db.execute(sql`
        SELECT event_type, period, time_seconds, team_id,
               player1_id, player2_id, player3_id, penalty_minutes
        FROM game_events
        WHERE game_id = ${gameId}
          AND event_type IN ('goal','shot','missed_shot','blocked_shot',
                             'hit','penalty','faceoff')
      `),
    ]);

    const shifts: ShiftRecord[] = unwrapRows<ShiftRow>(shiftsRes).map((s) => ({
      playerId: s.player_id,
      teamId: s.team_id,
      period: s.period,
      startSeconds: s.start_seconds,
      endSeconds: s.end_seconds,
    }));
    const events: EventRecord[] = unwrapRows<EventRow>(eventsRes).map((e) => ({
      eventType: e.event_type,
      period: e.period,
      timeSeconds: e.time_seconds,
      teamId: e.team_id,
      player1Id: e.player1_id,
      player2Id: e.player2_id,
      player3Id: e.player3_id,
      penaltyMinutes: e.penalty_minutes,
    }));

    if (shifts.length === 0) {
      return NextResponse.json({ error: "No shift data for this game" }, { status: 404 });
    }

    // Compute full-game team stats from events (not just shared ice).
    function emptyTeamStats() {
      return { goals: 0, shots: 0, hits: 0, blocks: 0, penalties: 0, faceoffWins: 0 };
    }
    const teamStatsByTeamId = new Map<number, ReturnType<typeof emptyTeamStats>>();
    function getTeamStats(teamId: number) {
      let s = teamStatsByTeamId.get(teamId);
      if (!s) {
        s = emptyTeamStats();
        teamStatsByTeamId.set(teamId, s);
      }
      return s;
    }
    const homeId = game.home_team_id;
    const awayId = game.away_team_id;
    const otherTeamOf = (id: number | null): number | null =>
      id === homeId ? awayId : id === awayId ? homeId : null;

    for (const e of events) {
      if (e.teamId == null) continue;
      switch (e.eventType) {
        case "goal": {
          const ts = getTeamStats(e.teamId);
          ts.goals++;
          ts.shots++; // a goal is a shot on goal
          break;
        }
        case "shot": {
          getTeamStats(e.teamId).shots++;
          break;
        }
        case "blocked_shot": {
          // event.teamId = shooter team; the BLOCK belongs to the other team
          const blockerTeam = otherTeamOf(e.teamId);
          if (blockerTeam != null) getTeamStats(blockerTeam).blocks++;
          break;
        }
        case "missed_shot":
          // doesn't reach the net; not counted as SOG, no team stat
          break;
        case "hit": {
          getTeamStats(e.teamId).hits++;
          break;
        }
        case "penalty": {
          getTeamStats(e.teamId).penalties++;
          break;
        }
        case "faceoff": {
          getTeamStats(e.teamId).faceoffWins++;
          break;
        }
      }
    }
    const teamStats = {
      home: homeId != null ? (teamStatsByTeamId.get(homeId) ?? emptyTeamStats()) : emptyTeamStats(),
      away: awayId != null ? (teamStatsByTeamId.get(awayId) ?? emptyTeamStats()) : emptyTeamStats(),
    };

    // Compute per-pair stats for the game
    const pairMap = computeGameVersus(shifts, events);

    // Filter to cross-team pairs with meaningful shared TOI
    const crossTeamPairs = Array.from(pairMap.values()).filter(
      (p) => !p.sameTeam && p.toiSharedSeconds >= MIN_SHARED_SECONDS
    );

    if (crossTeamPairs.length === 0) {
      return cachedJson(
        {
          game: shapeGame(game),
          teamStats,
          pairs: [],
        },
        DERIVED
      );
    }

    // Bulk-load player info
    const playerIds = Array.from(
      new Set(crossTeamPairs.flatMap((p) => [p.playerAId, p.playerBId]))
    );
    const playerIdList = sql.join(playerIds.map((id) => sql`${id}`), sql`, `);
    const playerRowsRes = await db.execute(sql`
      SELECT p.id, p.first_name, p.last_name, p.position, p.headshot_url, p.current_team_id
      FROM players p
      WHERE p.id IN (${playerIdList})
    `);
    const playerById = new Map<number, PlayerRow>();
    for (const p of unwrapRows<PlayerRow>(playerRowsRes)) {
      playerById.set(p.id, p);
    }

    // Bulk-load career aggregates for these pairs
    // versus_stats stores playerAId < playerBId; the pair keys use lower-first ordering already
    const careerByPair = new Map<string, CareerRow>();
    if (crossTeamPairs.length > 0) {
      // Build (a, b) tuple list for SQL match
      const pairTuples = crossTeamPairs.map((p) => sql`(${p.playerAId}, ${p.playerBId})`);
      const careerRes = await db.execute(sql`
        SELECT
          player_a_id, player_b_id,
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
          SUM(penalty_minutes_a)::int AS penalty_minutes_a,
          SUM(penalty_minutes_b)::int AS penalty_minutes_b,
          SUM(faceoff_wins_a)::int AS faceoff_wins_a,
          SUM(faceoff_wins_b)::int AS faceoff_wins_b,
          SUM(wins_a)::int AS wins_a,
          SUM(wins_b)::int AS wins_b
        FROM versus_stats
        WHERE same_team = false
          AND (player_a_id, player_b_id) IN (${sql.join(pairTuples, sql`, `)})
        GROUP BY player_a_id, player_b_id
      `);
      for (const c of unwrapRows<CareerRow>(careerRes)) {
        careerByPair.set(`${c.player_a_id}-${c.player_b_id}`, c);
      }
    }

    // Determine per-pair team -> wins
    function winsForPair(stats: PairStats): { winsA: number; winsB: number } {
      if (homeWon == null || awayWon == null) return { winsA: 0, winsB: 0 };
      const aIsHome = stats.playerATeamId === game.home_team_id;
      const aWon = aIsHome ? homeWon : awayWon;
      return { winsA: aWon ? 1 : 0, winsB: aWon ? 0 : 1 };
    }

    const pairs = crossTeamPairs
      .map((stats) => {
        const playerA = playerById.get(stats.playerAId);
        const playerB = playerById.get(stats.playerBId);
        if (!playerA || !playerB) return null;

        const aIsGoalie = playerA.position === "G";
        const bIsGoalie = playerB.position === "G";
        const isGoalieMatchup = aIsGoalie !== bIsGoalie; // exactly one goalie
        const bothGoalies = aIsGoalie && bIsGoalie;
        if (bothGoalies) return null;

        const { winsA, winsB } = winsForPair(stats);

        const gameRivalryScore = rivalryFromPair(
          stats,
          isGoalieMatchup,
          aIsGoalie, // goalieIsA
          winsA,
          winsB,
          1
        );

        const career = careerByPair.get(`${stats.playerAId}-${stats.playerBId}`);
        let careerAggScore: number | null = null;
        let careerAvgScorePerGame: number | null = null;
        let careerStatsAPerGame: PerspectiveStats | null = null;
        let careerStatsBPerGame: PerspectiveStats | null = null;
        let careerAvgToiPerGame: number | null = null;
        let careerGamesShared = 0;
        let careerToi = 0;

        if (career && career.games_shared > 0) {
          careerGamesShared = career.games_shared;
          careerToi = career.toi_shared_seconds;
          careerAvgToiPerGame = career.toi_shared_seconds / career.games_shared;

          // Career rivalry score, normalized to a per-game figure so it's
          // comparable to thisGame's score (which is always a single game).
          // computeSkaterRivalryScore already averages internally; goalie
          // scores intentionally accumulate over the career (see
          // rivalry-score.ts), so divide that one down to per-game here.
          careerAggScore = isGoalieMatchup
            ? computeGoalieRivalryScore({
                toiSharedSeconds: career.toi_shared_seconds,
                gamesShared: career.games_shared,
                skaterShots: aIsGoalie ? career.player_b_shots : career.player_a_shots,
                skaterGoals: aIsGoalie ? career.player_b_goals : career.player_a_goals,
                skaterAssists: aIsGoalie ? career.player_b_assists : career.player_a_assists,
                winsA: career.wins_a,
                winsB: career.wins_b,
              }) / career.games_shared
            : computeSkaterRivalryScore({
                toiSharedSeconds: career.toi_shared_seconds,
                gamesShared: career.games_shared,
                hitsByA: career.hits_by_a,
                hitsByB: career.hits_by_b,
                blocksByA: career.blocks_by_a,
                blocksByB: career.blocks_by_b,
                penaltyMinutesA: career.penalty_minutes_a,
                penaltyMinutesB: career.penalty_minutes_b,
                faceoffWinsA: career.faceoff_wins_a,
                faceoffWinsB: career.faceoff_wins_b,
                playerAGoals: career.player_a_goals,
                playerAAssists: career.player_a_assists,
                playerAShots: career.player_a_shots,
                playerBGoals: career.player_b_goals,
                playerBAssists: career.player_b_assists,
                playerBShots: career.player_b_shots,
                winsA: career.wins_a,
                winsB: career.wins_b,
              });
          careerAvgScorePerGame = careerAggScore;

          careerStatsAPerGame = {
            goals: career.player_a_goals / career.games_shared,
            assists: career.player_a_assists / career.games_shared,
            shots: career.player_a_shots / career.games_shared,
            hits: career.hits_by_a / career.games_shared,
            blocks: career.blocks_by_a / career.games_shared,
            penalties: career.penalty_minutes_a / career.games_shared,
            faceoffWins: career.faceoff_wins_a / career.games_shared,
          };
          careerStatsBPerGame = {
            goals: career.player_b_goals / career.games_shared,
            assists: career.player_b_assists / career.games_shared,
            shots: career.player_b_shots / career.games_shared,
            hits: career.hits_by_b / career.games_shared,
            blocks: career.blocks_by_b / career.games_shared,
            penalties: career.penalty_minutes_b / career.games_shared,
            faceoffWins: career.faceoff_wins_b / career.games_shared,
          };
        }

        return {
          playerA: shapePlayer(playerA, stats.playerATeamId, game),
          playerB: shapePlayer(playerB, stats.playerBTeamId, game),
          isGoalieMatchup,
          thisGame: {
            toiSharedSeconds: stats.toiSharedSeconds,
            rivalryScore: gameRivalryScore,
            statsA: statsFromPair(stats, "A"),
            statsB: statsFromPair(stats, "B"),
            wonA: winsA === 1,
            wonB: winsB === 1,
          },
          career: career && career.games_shared > 0
            ? {
                gamesShared: careerGamesShared,
                toiSharedSeconds: careerToi,
                avgToiPerGame: careerAvgToiPerGame!,
                avgRivalryScore: careerAvgScorePerGame!,
                avgStatsA: careerStatsAPerGame!,
                avgStatsB: careerStatsBPerGame!,
              }
            : null,
          rivalryDelta:
            careerAvgScorePerGame != null ? gameRivalryScore - careerAvgScorePerGame : null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    pairs.sort((a, b) => b.thisGame.rivalryScore - a.thisGame.rivalryScore);

    return cachedJson({ game: shapeGame(game), teamStats, pairs }, DERIVED);
  } catch (err: unknown) {
    return apiError("Game breakdown API error", err);
  }
}

function shapeGame(game: GameRow) {
  return {
    id: game.id,
    seasonId: game.season_id,
    date: game.game_date,
    home: {
      id: game.home_team_id,
      abbrev: game.home_abbrev,
      name: game.home_name,
      logoUrl: game.home_logo_url,
      score: game.home_score,
    },
    away: {
      id: game.away_team_id,
      abbrev: game.away_abbrev,
      name: game.away_name,
      logoUrl: game.away_logo_url,
      score: game.away_score,
    },
  };
}

function shapePlayer(player: PlayerRow, teamId: number, game: GameRow) {
  const teamAbbrev = teamId === game.home_team_id
    ? game.home_abbrev
    : teamId === game.away_team_id
    ? game.away_abbrev
    : null;
  const teamLogoUrl = teamId === game.home_team_id
    ? game.home_logo_url
    : teamId === game.away_team_id
    ? game.away_logo_url
    : null;
  return {
    id: player.id,
    firstName: player.first_name,
    lastName: player.last_name,
    position: player.position,
    headshotUrl: player.headshot_url,
    teamId,
    teamAbbrev,
    teamLogoUrl,
  };
}
