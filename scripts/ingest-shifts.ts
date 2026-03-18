/**
 * Fetches shift chart data for all games and populates the `shifts` table.
 *
 * Usage: npx tsx scripts/ingest-shifts.ts [--season 20242025]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { games, shifts, players } from "../src/db/schema";
import { getShiftChart } from "../src/lib/nhl-api";
import { parseTimeToSeconds } from "../src/lib/time-utils";
import { Progress } from "./lib/progress";

const seasonFilter = process.argv.find(
  (_, i, a) => a[i - 1] === "--season"
);

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  // Get games that haven't had shifts ingested yet
  let query = db
    .select({ id: games.id, seasonId: games.seasonId })
    .from(games)
    .where(eq(games.shiftsIngested, false));

  const pendingGames = await query;
  const filtered = seasonFilter
    ? pendingGames.filter((g) => g.seasonId === seasonFilter)
    : pendingGames;

  console.log(
    `${filtered.length} games need shift ingestion${seasonFilter ? ` (season ${seasonFilter})` : ""}`
  );

  if (filtered.length === 0) {
    console.log("Nothing to do.");
    await client.end();
    return;
  }

  const knownPlayers = await db.select({ id: players.id }).from(players);
  const knownPlayerIds = new Set(knownPlayers.map((p) => p.id));
  console.log(`${knownPlayerIds.size} known players`);

  const progress = new Progress(filtered.length, "Ingesting shifts");
  let totalShifts = 0;

  for (const game of filtered) {
    try {
      const shiftData = await getShiftChart(game.id);

      if (!shiftData.data || shiftData.data.length === 0) {
        // Mark as ingested even if no data (e.g., cancelled games)
        await db
          .update(games)
          .set({ shiftsIngested: true })
          .where(eq(games.id, game.id));
        progress.increment();
        continue;
      }

      const shiftRows = shiftData.data
        .filter((s) => s.period > 0 && s.startTime && s.endTime && knownPlayerIds.has(s.playerId))
        .map((s) => ({
          gameId: game.id,
          playerId: s.playerId,
          teamId: s.teamId,
          period: s.period,
          startSeconds: parseTimeToSeconds(s.startTime),
          endSeconds: parseTimeToSeconds(s.endTime),
          shiftNumber: s.shiftNumber,
        }));

      // Batch insert shifts
      const BATCH_SIZE = 500;
      for (let i = 0; i < shiftRows.length; i += BATCH_SIZE) {
        const batch = shiftRows.slice(i, i + BATCH_SIZE);
        await db.insert(shifts).values(batch);
      }

      // Mark game as shifts-ingested
      await db
        .update(games)
        .set({ shiftsIngested: true })
        .where(eq(games.id, game.id));

      totalShifts += shiftRows.length;
    } catch (err) {
      console.warn(
        `\nWarning: Failed to ingest shifts for game ${game.id}: ${err instanceof Error ? err.message : err}`
      );
    }
    progress.increment();
  }
  progress.done();

  console.log(`\nDone! Inserted ${totalShifts} shift records.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
