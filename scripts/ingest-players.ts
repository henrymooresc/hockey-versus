/**
 * Populates the `players` table by fetching boxscores for all games
 * and then enriching with player landing page data.
 *
 * Usage: npx tsx scripts/ingest-players.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { games, players } from "../src/db/schema";
import { getBoxscore, getPlayerLanding } from "../src/lib/nhl-api";
import { Progress } from "./lib/progress";

function extractPlayersFromBoxscore(boxscore: any): Set<number> {
  const playerIds = new Set<number>();
  const stats = boxscore.playerByGameStats;
  if (!stats) return playerIds;

  for (const side of ["homeTeam", "awayTeam"] as const) {
    const teamStats = stats[side];
    if (!teamStats) continue;
    for (const group of ["forwards", "defense", "goalies"] as const) {
      const playerList = teamStats[group];
      if (!Array.isArray(playerList)) continue;
      for (const p of playerList) {
        if (p.playerId) playerIds.add(p.playerId);
      }
    }
  }
  return playerIds;
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  // 1. Get all games
  const allGames = await db.select({ id: games.id }).from(games);
  console.log(`Found ${allGames.length} games in database`);

  // 2. Discover unique player IDs from boxscores
  const allPlayerIds = new Set<number>();
  const existingPlayers = await db.select({ id: players.id }).from(players);
  for (const p of existingPlayers) allPlayerIds.add(p.id);
  console.log(`Already have ${allPlayerIds.size} players in database`);

  const newPlayerIds = new Set<number>();
  const progress1 = new Progress(allGames.length, "Scanning boxscores");

  // Sample a subset of games if there are many (every team plays ~82 games,
  // so checking every 5th game should catch all players)
  const sampled =
    allGames.length > 2000
      ? allGames.filter((_, i) => i % 5 === 0)
      : allGames;

  for (const game of sampled) {
    try {
      const boxscore = await getBoxscore(game.id);
      const ids = extractPlayersFromBoxscore(boxscore);
      for (const id of ids) {
        if (!allPlayerIds.has(id)) {
          newPlayerIds.add(id);
          allPlayerIds.add(id);
        }
      }
    } catch (err) {
      console.warn(
        `\nWarning: Could not fetch boxscore for game ${game.id}: ${err instanceof Error ? err.message : err}`
      );
    }
    progress1.increment();
  }
  progress1.done();

  console.log(`Found ${newPlayerIds.size} new players to fetch`);

  // 3. Fetch player landing pages and insert
  const progress2 = new Progress(newPlayerIds.size, "Fetching player details");
  const playerIdArray = Array.from(newPlayerIds);

  for (const playerId of playerIdArray) {
    try {
      const landing = await getPlayerLanding(playerId);

      await db
        .insert(players)
        .values({
          id: landing.playerId,
          firstName: landing.firstName.default,
          lastName: landing.lastName.default,
          position: landing.position,
          shootsCatches: landing.shootsCatches,
          headshotUrl: landing.headshot,
          birthDate: landing.birthDate,
          currentTeamId: landing.currentTeamId ?? null,
          sweaterNumber: landing.sweaterNumber ?? null,
          searchText: `${landing.firstName.default} ${landing.lastName.default}`.toLowerCase(),
        })
        .onConflictDoUpdate({
          target: players.id,
          set: {
            currentTeamId: landing.currentTeamId ?? null,
            headshotUrl: landing.headshot,
            sweaterNumber: landing.sweaterNumber ?? null,
            searchText: `${landing.firstName.default} ${landing.lastName.default}`.toLowerCase(),
          },
        });
    } catch (err) {
      console.warn(
        `\nWarning: Could not fetch player ${playerId}: ${err instanceof Error ? err.message : err}`
      );
    }
    progress2.increment();
  }
  progress2.done();

  const finalCount = await db.select({ id: players.id }).from(players);
  console.log(`\nDone! ${finalCount.length} total players in database.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
