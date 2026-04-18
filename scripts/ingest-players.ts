/**
 * Populates the `players` table by fetching boxscores for all games
 * and then enriching with player landing page data.
 *
 * Usage: npx tsx scripts/ingest-players.ts [--seasons 20242025,20232024]
 * Default: current season only.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inArray } from "drizzle-orm";
import { games, players } from "../src/db/schema";
import { getBoxscore, getPlayerLanding, setFetchImpl } from "../src/lib/nhl-api";
import { rateLimitedFetch } from "./lib/rate-limiter";
import { Progress } from "./lib/progress";
import { parseTargetSeasons } from "./lib/seasons";

setFetchImpl(rateLimitedFetch);

const targetSeasons = parseTargetSeasons();
const CONCURRENCY = 5;

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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  // 1. Get games for target seasons
  const allGames = await db
    .select({ id: games.id })
    .from(games)
    .where(inArray(games.seasonId, targetSeasons));
  console.log(`Found ${allGames.length} games for seasons: ${targetSeasons.join(", ")}`);

  // 2. Discover unique player IDs from boxscores (parallel)
  const allPlayerIds = new Set<number>();
  const existingPlayers = await db.select({ id: players.id }).from(players);
  for (const p of existingPlayers) allPlayerIds.add(p.id);
  console.log(`Already have ${allPlayerIds.size} players in database`);

  const newPlayerIds = new Set<number>();
  const progress1 = new Progress(allGames.length, "Scanning boxscores");

  for (let i = 0; i < allGames.length; i += CONCURRENCY) {
    const batch = allGames.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (game) => {
        try {
          return await getBoxscore(game.id);
        } catch (err) {
          console.warn(
            `\nWarning: Could not fetch boxscore for game ${game.id}: ${err instanceof Error ? err.message : err}`
          );
          return null;
        }
      })
    );
    for (const boxscore of results) {
      if (!boxscore) continue;
      const ids = extractPlayersFromBoxscore(boxscore);
      for (const id of ids) {
        if (!allPlayerIds.has(id)) {
          newPlayerIds.add(id);
          allPlayerIds.add(id);
        }
      }
    }
    progress1.increment(batch.length);
  }
  progress1.done();

  console.log(`Found ${newPlayerIds.size} new players to fetch`);

  // 3. Fetch player landing pages and insert (parallel)
  const progress2 = new Progress(newPlayerIds.size, "Fetching player details");
  const playerIdArray = Array.from(newPlayerIds);

  for (let i = 0; i < playerIdArray.length; i += CONCURRENCY) {
    const batch = playerIdArray.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (playerId) => {
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
      })
    );
    progress2.increment(batch.length);
  }
  progress2.done();

  console.log(`\nDone! ${allPlayerIds.size} total players in database.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
