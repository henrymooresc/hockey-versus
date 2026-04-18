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
import { and, eq, inArray } from "drizzle-orm";
import { games, players, seasons } from "../src/db/schema";
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

  // 1. Load last-scanned timestamps for target seasons
  const seasonRows = await db
    .select({ id: seasons.id, lastPlayersScannedAt: seasons.lastPlayersScannedAt })
    .from(seasons)
    .where(inArray(seasons.id, targetSeasons));
  const lastScannedAt = new Map(seasonRows.map((s) => [s.id, s.lastPlayersScannedAt]));

  for (const sid of targetSeasons) {
    const cutoff = lastScannedAt.get(sid) ?? null;
    console.log(
      cutoff
        ? `Season ${sid}: scanning boxscores for games since ${cutoff.toISOString().slice(0, 10)}`
        : `Season ${sid}: scanning all boxscores (first run)`
    );
  }

  // 2. Get games for target seasons, skipping already-scanned ones.
  //    Each season tracks its own cutoff, so filter in memory after one query.
  const allCandidates = await db
    .select({ id: games.id, seasonId: games.seasonId, gameDate: games.gameDate })
    .from(games)
    .where(inArray(games.seasonId, targetSeasons));

  const newGames = allCandidates.filter((g) => {
    const cutoff = lastScannedAt.get(g.seasonId) ?? null;
    if (!cutoff) return true;
    return new Date(g.gameDate) > cutoff;
  });

  console.log(
    `Found ${newGames.length} new game(s) to scan (${allCandidates.length} total for target seasons)`
  );

  // 3. Discover unique player IDs from boxscores (parallel)
  const existingPlayers = await db.select({ id: players.id }).from(players);
  const allPlayerIds = new Set(existingPlayers.map((p) => p.id));
  console.log(`Already have ${allPlayerIds.size} players in database`);

  const newPlayerIds = new Set<number>();

  if (newGames.length > 0) {
    const progress1 = new Progress(newGames.length, "Scanning boxscores");

    for (let i = 0; i < newGames.length; i += CONCURRENCY) {
      const batch = newGames.slice(i, i + CONCURRENCY);
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
  }

  console.log(`Found ${newPlayerIds.size} new players to fetch`);

  // 4. Fetch player landing pages and insert (parallel)
  if (newPlayerIds.size > 0) {
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
  }

  // 5. Update last-scanned timestamp for each season
  const now = new Date();
  for (const sid of targetSeasons) {
    await db
      .update(seasons)
      .set({ lastPlayersScannedAt: now })
      .where(eq(seasons.id, sid));
  }

  console.log(`\nDone! ${allPlayerIds.size} total players in database.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
