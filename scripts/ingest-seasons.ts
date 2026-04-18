/**
 * Discovers all game IDs for the target seasons and populates
 * the `seasons` and `games` tables.
 *
 * Usage: npx tsx scripts/ingest-seasons.ts [--seasons N]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { seasons, games, teams } from "../src/db/schema";
import { getStandings, getClubSeasonSchedule, setFetchImpl } from "../src/lib/nhl-api";
import { rateLimitedFetch } from "./lib/rate-limiter";
import { Progress } from "./lib/progress";

setFetchImpl(rateLimitedFetch);

const NUM_SEASONS = parseInt(
  process.argv.find((_, i, a) => a[i - 1] === "--seasons") ?? "10",
  10
);

const CONCURRENCY = 5;

function getCurrentSeasonId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  // NHL season starts in October. If before October, we're in the prev year's season.
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

function getSeasonIds(count: number): string[] {
  const current = getCurrentSeasonId();
  const startYear = parseInt(current.slice(0, 4), 10);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    result.push(`${y}${y + 1}`);
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log(`Ingesting ${NUM_SEASONS} seasons...`);
  const seasonIds = getSeasonIds(NUM_SEASONS);
  console.log("Seasons:", seasonIds.join(", "));

  // 1. Insert seasons
  for (const sid of seasonIds) {
    await db
      .insert(seasons)
      .values({ id: sid, ingested: false })
      .onConflictDoNothing();
  }

  // 2. Get team metadata (name, logo) from standings, keyed by abbrev
  console.log("Fetching team list from standings...");
  const standings = await getStandings();
  const standingsMap = new Map(
    standings.standings.map((t) => [
      t.teamAbbrev.default,
      { name: t.teamCommonName.default, logoUrl: t.teamLogo },
    ])
  );
  const abbrevList = Array.from(standingsMap.keys());

  // 3. For each season, fetch schedule from each team to discover game IDs
  //    and collect team IDs (standings doesn't provide them, but schedule does)
  const allGameIds = new Set<number>();
  const gameRows: Map<
    number,
    {
      id: number;
      seasonId: string;
      gameType: number;
      gameDate: string;
      homeTeamId: number | null;
      awayTeamId: number | null;
      homeScore: number | null;
      awayScore: number | null;
    }
  > = new Map();
  const teamById = new Map<number, { id: number; abbrev: string; name: string; logoUrl: string | null }>();

  for (const sid of seasonIds) {
    console.log(`\nDiscovering games for season ${sid}...`);
    const progress = new Progress(abbrevList.length, `Season ${sid}`);

    for (let i = 0; i < abbrevList.length; i += CONCURRENCY) {
      const batch = abbrevList.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (abbrev) => {
          try {
            const schedule = await getClubSeasonSchedule(abbrev, sid);
            return { abbrev, schedule };
          } catch (err) {
            // Some teams may not exist in older seasons
            console.warn(
              `\nWarning: Could not fetch schedule for ${abbrev} in ${sid}: ${err instanceof Error ? err.message : err}`
            );
            return null;
          }
        })
      );

      for (const result of results) {
        if (!result) continue;
        const { schedule } = result;
        for (const game of schedule.games) {
          // Only include regular season (2) and playoffs (3)
          if (game.gameType !== 2 && game.gameType !== 3) continue;
          // Only include completed games
          if (game.gameState !== "OFF" && game.gameState !== "FINAL") continue;

          // Collect team IDs from game data
          for (const side of [game.homeTeam, game.awayTeam]) {
            if (!teamById.has(side.id)) {
              const meta = standingsMap.get(side.abbrev);
              teamById.set(side.id, {
                id: side.id,
                abbrev: side.abbrev,
                name: meta?.name ?? side.abbrev,
                logoUrl: meta?.logoUrl ?? null,
              });
            }
          }

          if (!allGameIds.has(game.id)) {
            allGameIds.add(game.id);
            gameRows.set(game.id, {
              id: game.id,
              seasonId: sid,
              gameType: game.gameType,
              gameDate: game.gameDate,
              homeTeamId: game.homeTeam.id,
              awayTeamId: game.awayTeam.id,
              homeScore: game.homeTeam.score ?? null,
              awayScore: game.awayTeam.score ?? null,
            });
          }
        }
      }

      progress.increment(batch.length);
    }
  }

  // 3b. Insert teams now that we have their IDs from schedule data
  const teamList = Array.from(teamById.values());
  if (teamList.length > 0) {
    await db.insert(teams).values(teamList).onConflictDoNothing();
  }
  console.log(`\nInserted/updated ${teamList.length} teams`);

  // 4. Batch insert games
  console.log(`\nInserting ${gameRows.size} games...`);
  const gameValues = Array.from(gameRows.values());
  const BATCH_SIZE = 500;

  for (let i = 0; i < gameValues.length; i += BATCH_SIZE) {
    const batch = gameValues.slice(i, i + BATCH_SIZE);
    await db.insert(games).values(batch).onConflictDoNothing();
  }

  // 5. Mark seasons as ingested
  for (const sid of seasonIds) {
    await db
      .update(seasons)
      .set({ ingested: true })
      .where(eq(seasons.id, sid));
  }

  console.log(
    `\nDone! Discovered ${gameRows.size} games across ${NUM_SEASONS} seasons.`
  );
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
