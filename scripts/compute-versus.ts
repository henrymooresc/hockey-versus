/**
 * Computes versus stats from shifts + events data and populates versus_stats.
 *
 * Usage: npx tsx scripts/compute-versus.ts [--season 20242025]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql, inArray } from "drizzle-orm";
import { games, shifts, gameEvents, versusStats } from "../src/db/schema";
import {
  computeGameVersus,
  type ShiftRecord,
  type EventRecord,
  type PairStats,
} from "../src/lib/versus-engine";
import { computeSkaterRivalryScore } from "../src/lib/rivalry-score";
import { Progress } from "./lib/progress";

const seasonFilter = process.argv.find(
  (_, i, a) => a[i - 1] === "--season"
);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  // Get games that have both shifts and events ingested
  const eligibleGames = await db
    .select({
      id: games.id,
      seasonId: games.seasonId,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
    })
    .from(games)
    .where(
      and(eq(games.shiftsIngested, true), eq(games.eventsIngested, true))
    );

  const filtered = seasonFilter
    ? eligibleGames.filter((g) => g.seasonId === seasonFilter)
    : eligibleGames;

  console.log(
    `Computing versus stats for ${filtered.length} games${seasonFilter ? ` (season ${seasonFilter})` : ""}`
  );

  if (filtered.length === 0) {
    console.log("Nothing to do.");
    await client.end();
    return;
  }

  const progress = new Progress(filtered.length, "Computing versus");

  // Accumulate stats per pair per season
  const accumulator = new Map<
    string,
    PairStats & { seasonId: string; gamesShared: number; winsA: number; winsB: number }
  >();

  // Process in chunks to avoid loading all shifts+events into memory at once
  const GAME_CHUNK = 500;

  for (let gi = 0; gi < filtered.length; gi += GAME_CHUNK) {
    const chunk = filtered.slice(gi, gi + GAME_CHUNK);
    const chunkIds = chunk.map((g) => g.id);

    const [chunkShifts, chunkEvents] = await Promise.all([
      db
        .select({
          gameId: shifts.gameId,
          playerId: shifts.playerId,
          teamId: shifts.teamId,
          period: shifts.period,
          startSeconds: shifts.startSeconds,
          endSeconds: shifts.endSeconds,
        })
        .from(shifts)
        .where(inArray(shifts.gameId, chunkIds)),
      db
        .select({
          gameId: gameEvents.gameId,
          eventType: gameEvents.eventType,
          period: gameEvents.period,
          timeSeconds: gameEvents.timeSeconds,
          teamId: gameEvents.teamId,
          player1Id: gameEvents.player1Id,
          player2Id: gameEvents.player2Id,
          player3Id: gameEvents.player3Id,
        })
        .from(gameEvents)
        .where(inArray(gameEvents.gameId, chunkIds)),
    ]);

    const shiftsByGame = new Map<number, ShiftRecord[]>();
    for (const s of chunkShifts) {
      if (!shiftsByGame.has(s.gameId)) shiftsByGame.set(s.gameId, []);
      shiftsByGame.get(s.gameId)!.push(s as ShiftRecord);
    }

    const eventsByGame = new Map<number, EventRecord[]>();
    for (const e of chunkEvents) {
      if (!eventsByGame.has(e.gameId)) eventsByGame.set(e.gameId, []);
      eventsByGame.get(e.gameId)!.push(e as EventRecord);
    }

    for (const game of chunk) {
      try {
        const gameShifts = shiftsByGame.get(game.id) ?? [];
        const gameEvts = eventsByGame.get(game.id) ?? [];

        if (gameShifts.length === 0) {
          progress.increment();
          continue;
        }

        const pairStats = computeGameVersus(gameShifts, gameEvts);

        // Determine game winner team ID
        const winnerTeamId =
          game.homeScore !== null && game.awayScore !== null && game.homeScore !== game.awayScore
            ? game.homeScore > game.awayScore
              ? game.homeTeamId
              : game.awayTeamId
            : null;

        // Accumulate into season-level stats
        for (const [pairKey, stats] of pairStats) {
          const accKey = `${pairKey}-${game.seasonId}`;

          const pairWinsA = winnerTeamId === stats.playerATeamId ? 1 : 0;
          const pairWinsB = winnerTeamId === stats.playerBTeamId ? 1 : 0;

          if (!accumulator.has(accKey)) {
            accumulator.set(accKey, {
              ...stats,
              seasonId: game.seasonId,
              gamesShared: 1,
              winsA: pairWinsA,
              winsB: pairWinsB,
            });
          } else {
            const existing = accumulator.get(accKey)!;
            existing.gamesShared++;
            existing.winsA += pairWinsA;
            existing.winsB += pairWinsB;

            existing.toiSharedSeconds += stats.toiSharedSeconds;
            existing.goalsForA += stats.goalsForA;
            existing.goalsAgainstA += stats.goalsAgainstA;
            existing.goalsForB += stats.goalsForB;
            existing.goalsAgainstB += stats.goalsAgainstB;
            existing.shotsForA += stats.shotsForA;
            existing.shotsAgainstA += stats.shotsAgainstA;
            existing.shotsForB += stats.shotsForB;
            existing.shotsAgainstB += stats.shotsAgainstB;
            existing.hitsByA += stats.hitsByA;
            existing.hitsByB += stats.hitsByB;
            existing.blocksByA += stats.blocksByA;
            existing.blocksByB += stats.blocksByB;
            existing.penaltiesByA += stats.penaltiesByA;
            existing.penaltiesByB += stats.penaltiesByB;
            existing.faceoffWinsA += stats.faceoffWinsA;
            existing.faceoffWinsB += stats.faceoffWinsB;
            existing.playerAGoals += stats.playerAGoals;
            existing.playerAAssists += stats.playerAAssists;
            existing.playerAShots += stats.playerAShots;
            existing.playerBGoals += stats.playerBGoals;
            existing.playerBAssists += stats.playerBAssists;
            existing.playerBShots += stats.playerBShots;
          }
        }
      } catch (err) {
        console.warn(
          `\nWarning: Failed to compute versus for game ${game.id}: ${err instanceof Error ? err.message : err}`
        );
      }
      progress.increment();
    }
  }
  progress.done();

  // Upsert accumulated stats into versus_stats
  console.log(`\nUpserting ${accumulator.size} pair-season records...`);
  const upsertProgress = new Progress(accumulator.size, "Upserting");
  const entries = Array.from(accumulator.values());
  const BATCH_SIZE = 100;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((row) => ({
      playerAId: row.playerAId,
      playerBId: row.playerBId,
      seasonId: row.seasonId,
      sameTeam: row.sameTeam,
      gamesShared: row.gamesShared,
      toiSharedSeconds: row.toiSharedSeconds,
      winsA: row.winsA,
      winsB: row.winsB,
      playerATeamId: row.playerATeamId,
      playerBTeamId: row.playerBTeamId,
      goalsForA: row.goalsForA,
      goalsAgainstA: row.goalsAgainstA,
      goalsForB: row.goalsForB,
      goalsAgainstB: row.goalsAgainstB,
      shotsForA: row.shotsForA,
      shotsAgainstA: row.shotsAgainstA,
      shotsForB: row.shotsForB,
      shotsAgainstB: row.shotsAgainstB,
      hitsByA: row.hitsByA,
      hitsByB: row.hitsByB,
      blocksByA: row.blocksByA,
      blocksByB: row.blocksByB,
      penaltiesByA: row.penaltiesByA,
      penaltiesByB: row.penaltiesByB,
      faceoffWinsA: row.faceoffWinsA,
      faceoffWinsB: row.faceoffWinsB,
      playerAGoals: row.playerAGoals,
      playerAAssists: row.playerAAssists,
      playerAShots: row.playerAShots,
      playerBGoals: row.playerBGoals,
      playerBAssists: row.playerBAssists,
      playerBShots: row.playerBShots,
      rivalryScore: row.sameTeam ? null : computeSkaterRivalryScore(row),
    }));

    // Single insert per batch using excluded pseudo-table for conflict resolution
    await db
      .insert(versusStats)
      .values(batch)
      .onConflictDoUpdate({
        target: [versusStats.playerAId, versusStats.playerBId, versusStats.seasonId],
        set: {
          sameTeam: sql`excluded.same_team`,
          gamesShared: sql`excluded.games_shared`,
          toiSharedSeconds: sql`excluded.toi_shared_seconds`,
          winsA: sql`excluded.wins_a`,
          winsB: sql`excluded.wins_b`,
          playerATeamId: sql`excluded.player_a_team_id`,
          playerBTeamId: sql`excluded.player_b_team_id`,
          goalsForA: sql`excluded.goals_for_a`,
          goalsAgainstA: sql`excluded.goals_against_a`,
          goalsForB: sql`excluded.goals_for_b`,
          goalsAgainstB: sql`excluded.goals_against_b`,
          shotsForA: sql`excluded.shots_for_a`,
          shotsAgainstA: sql`excluded.shots_against_a`,
          shotsForB: sql`excluded.shots_for_b`,
          shotsAgainstB: sql`excluded.shots_against_b`,
          hitsByA: sql`excluded.hits_by_a`,
          hitsByB: sql`excluded.hits_by_b`,
          blocksByA: sql`excluded.blocks_by_a`,
          blocksByB: sql`excluded.blocks_by_b`,
          penaltiesByA: sql`excluded.penalties_by_a`,
          penaltiesByB: sql`excluded.penalties_by_b`,
          faceoffWinsA: sql`excluded.faceoff_wins_a`,
          faceoffWinsB: sql`excluded.faceoff_wins_b`,
          playerAGoals: sql`excluded.player_a_goals`,
          playerAAssists: sql`excluded.player_a_assists`,
          playerAShots: sql`excluded.player_a_shots`,
          playerBGoals: sql`excluded.player_b_goals`,
          playerBAssists: sql`excluded.player_b_assists`,
          playerBShots: sql`excluded.player_b_shots`,
          rivalryScore: sql`excluded.rivalry_score`,
          computedAt: new Date(),
        },
      });

    upsertProgress.increment(batch.length);
  }
  upsertProgress.done();

  console.log(`\nDone! Upserted ${accumulator.size} versus stat records.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
