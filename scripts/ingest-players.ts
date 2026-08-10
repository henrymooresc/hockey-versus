/**
 * Populates the `players` table by fetching boxscores for all games
 * and then enriching with player landing page data.
 *
 * Usage: npx tsx scripts/ingest-players.ts [--seasons 20242025,20232024]
 * Default: current season only.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { games, players } from "../src/db/schema";
import { getBoxscore, getPlayerLanding, setFetchImpl } from "../src/lib/nhl-api";
import type { BoxscoreResponse } from "../src/types/nhl-api";
import { rateLimitedFetch } from "./lib/rate-limiter";
import { Progress } from "./lib/progress";
import { parseTargetSeasons } from "./lib/seasons";
import { createScriptDb } from "./lib/db";

setFetchImpl(rateLimitedFetch);

const targetSeasons = parseTargetSeasons();
const CONCURRENCY = 5;

function extractPlayersFromBoxscore(boxscore: BoxscoreResponse): Set<number> {
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
  const { client, db } = createScriptDb();

  // 1. Get games whose boxscore we have not read yet.
  //    The flag lives on the game, so a game that arrives late still gets
  //    scanned. A per-season timestamp skipped it forever once its date fell
  //    behind the cutoff.
  const newGames = await db
    .select({ id: games.id, seasonId: games.seasonId })
    .from(games)
    .where(and(inArray(games.seasonId, targetSeasons), eq(games.playersScanned, false)));

  const totalForSeasons = await db
    .select({ id: games.id })
    .from(games)
    .where(inArray(games.seasonId, targetSeasons));

  console.log(
    `Found ${newGames.length} unscanned game(s) (${totalForSeasons.length} total for target seasons)`
  );

  // 2. Discover unique player IDs from boxscores (parallel)
  const existingPlayers = await db.select({ id: players.id }).from(players);
  const allPlayerIds = new Set(existingPlayers.map((p) => p.id));
  console.log(`Already have ${allPlayerIds.size} players in database`);

  const newPlayerIds = new Set<number>();
  // Games whose boxscore read succeeded, and the players each one named.
  const readGames = new Map<number, Set<number>>();

  if (newGames.length > 0) {
    const progress1 = new Progress(newGames.length, "Scanning boxscores");

    for (let i = 0; i < newGames.length; i += CONCURRENCY) {
      const batch = newGames.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (game) => {
          try {
            return { gameId: game.id, boxscore: await getBoxscore(game.id) };
          } catch (err) {
            console.warn(
              `\nWarning: Could not fetch boxscore for game ${game.id}: ${err instanceof Error ? err.message : err}`
            );
            return null;
          }
        })
      );
      for (const result of results) {
        if (!result) continue;
        const ids = extractPlayersFromBoxscore(result.boxscore);
        readGames.set(result.gameId, ids);
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

  // 3. Fetch player landing pages and insert (parallel)
  const failedPlayerIds = new Set<number>();
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
            failedPlayerIds.add(playerId);
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

  // 4. Mark games whose players all resolved.
  //    A game whose player failed to load stays unscanned, so the next run
  //    retries it. Otherwise ingest-shifts would silently drop that player's
  //    shifts, because it skips shifts for anyone missing from `players`.
  const completedGameIds = Array.from(readGames.entries())
    .filter(([, ids]) => !Array.from(ids).some((id) => failedPlayerIds.has(id)))
    .map(([gameId]) => gameId);

  const MARK_BATCH = 500;
  for (let i = 0; i < completedGameIds.length; i += MARK_BATCH) {
    await db
      .update(games)
      .set({ playersScanned: true })
      .where(inArray(games.id, completedGameIds.slice(i, i + MARK_BATCH)));
  }

  const heldBack = newGames.length - completedGameIds.length;
  console.log(
    `\nDone! ${allPlayerIds.size} total players in database. ` +
      `Marked ${completedGameIds.length} game(s) scanned` +
      (heldBack > 0 ? `, held back ${heldBack} for the next run.` : ".")
  );
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
