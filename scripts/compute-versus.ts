/**
 * Computes versus stats from shifts + events data and populates versus_stats.
 *
 * Usage: npx tsx scripts/compute-versus.ts [--season 20242025]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql } from "drizzle-orm";
import { games, shifts, gameEvents, versusStats } from "../src/db/schema";
import {
  computeGameVersus,
  type ShiftRecord,
  type EventRecord,
  type PairStats,
} from "../src/lib/versus-engine";
import { Progress } from "./lib/progress";

const seasonFilter = process.argv.find(
  (_, i, a) => a[i - 1] === "--season"
);

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  // Get games that have both shifts and events ingested
  const eligibleGames = await db
    .select({ id: games.id, seasonId: games.seasonId })
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
    PairStats & { seasonId: string; gamesShared: number }
  >();

  for (const game of filtered) {
    try {
      // Load shifts for this game
      const gameShifts = await db
        .select({
          playerId: shifts.playerId,
          teamId: shifts.teamId,
          period: shifts.period,
          startSeconds: shifts.startSeconds,
          endSeconds: shifts.endSeconds,
        })
        .from(shifts)
        .where(eq(shifts.gameId, game.id));

      // Load events for this game
      const gameEvts = await db
        .select({
          eventType: gameEvents.eventType,
          period: gameEvents.period,
          timeSeconds: gameEvents.timeSeconds,
          teamId: gameEvents.teamId,
          player1Id: gameEvents.player1Id,
          player2Id: gameEvents.player2Id,
          player3Id: gameEvents.player3Id,
        })
        .from(gameEvents)
        .where(eq(gameEvents.gameId, game.id));

      if (gameShifts.length === 0) {
        progress.increment();
        continue;
      }

      const pairStats = computeGameVersus(
        gameShifts as ShiftRecord[],
        gameEvts as EventRecord[]
      );

      // Accumulate into season-level stats
      for (const [pairKey, stats] of pairStats) {
        const accKey = `${pairKey}-${game.seasonId}`;

        if (!accumulator.has(accKey)) {
          accumulator.set(accKey, {
            ...stats,
            seasonId: game.seasonId,
            gamesShared: 1,
          });
        } else {
          const existing = accumulator.get(accKey)!;
          existing.gamesShared++;
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
  progress.done();

  // Upsert accumulated stats into versus_stats
  console.log(`\nUpserting ${accumulator.size} pair-season records...`);
  const upsertProgress = new Progress(accumulator.size, "Upserting");
  const entries = Array.from(accumulator.values());
  const BATCH_SIZE = 100;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      await db
        .insert(versusStats)
        .values({
          playerAId: row.playerAId,
          playerBId: row.playerBId,
          seasonId: row.seasonId,
          sameTeam: row.sameTeam,
          gamesShared: row.gamesShared,
          toiSharedSeconds: row.toiSharedSeconds,
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
        })
        .onConflictDoUpdate({
          target: [
            versusStats.playerAId,
            versusStats.playerBId,
            versusStats.seasonId,
          ],
          set: {
            sameTeam: row.sameTeam,
            gamesShared: row.gamesShared,
            toiSharedSeconds: row.toiSharedSeconds,
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
            computedAt: new Date(),
          },
        });
    }
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
