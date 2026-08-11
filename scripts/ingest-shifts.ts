/**
 * Fetches shift chart data for all games and populates the `shifts` table.
 *
 * Uses the NHL Stats API as the primary source, falling back to HTML shift
 * reports when the Stats API returns empty data.
 *
 * Usage: npx tsx scripts/ingest-shifts.ts [--seasons 20242025,20232024]
 * Default: current season only.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { games, shifts, players, teams } from "../src/db/schema";
import { getShiftChart, getPlayByPlay, setFetchImpl } from "../src/lib/nhl-api";
import { getShiftChartFromHtml } from "../src/lib/html-shifts";
import { rateLimitedFetch } from "./lib/rate-limiter";

setFetchImpl(rateLimitedFetch);
import { parseTimeToSeconds } from "../src/lib/time-utils";
import { Progress } from "./lib/progress";
import { parseTargetSeasons } from "./lib/seasons";
import { createScriptDb } from "./lib/db";

const targetSeasons = parseTargetSeasons();

// Lower concurrency since HTML fallback may trigger 2-3 API calls per game
const CONCURRENCY = 3;

async function main() {
  const { client, db } = createScriptDb();

  // Get games that haven't had shifts ingested yet, limited to target seasons
  const filtered = await db
    .select({
      id: games.id,
      seasonId: games.seasonId,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
    })
    .from(games)
    .where(and(eq(games.shiftsIngested, false), inArray(games.seasonId, targetSeasons)));

  console.log(
    `${filtered.length} games need shift ingestion (seasons: ${targetSeasons.join(", ")})`
  );

  if (filtered.length === 0) {
    console.log("Nothing to do.");
    await client.end();
    return;
  }

  const knownPlayers = await db.select({ id: players.id }).from(players);
  const knownPlayerIds = new Set(knownPlayers.map((p) => p.id));
  console.log(`${knownPlayerIds.size} known players`);

  const knownTeams = await db.select({ id: teams.id }).from(teams);
  const knownTeamIds = new Set(knownTeams.map((t) => t.id));

  // Load team info for HTML fallback
  const allTeams = await db
    .select({ id: teams.id, abbrev: teams.abbrev, name: teams.name })
    .from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  const progress = new Progress(filtered.length, "Ingesting shifts");
  let totalShifts = 0;
  let htmlFallbackCount = 0;

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const batch = filtered.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (game) => {
        try {
          let shiftData = await getShiftChart(game.id);

          // Fallback to HTML shift reports if Stats API returns empty
          if (!shiftData.data || shiftData.data.length === 0) {
            const homeTeam = teamMap.get(game.homeTeamId!);
            const awayTeam = teamMap.get(game.awayTeamId!);

            if (homeTeam && awayTeam) {
              try {
                const pbp = await getPlayByPlay(game.id);
                shiftData = await getShiftChartFromHtml(
                  game.id,
                  game.seasonId,
                  homeTeam,
                  awayTeam,
                  pbp.rosterSpots,
                  rateLimitedFetch
                );
                if (shiftData.data.length > 0) htmlFallbackCount++;
              } catch (htmlErr) {
                console.warn(
                  `\n  HTML fallback failed for game ${game.id}: ${htmlErr instanceof Error ? htmlErr.message : htmlErr}`
                );
              }
            }
          }

          if (!shiftData.data || shiftData.data.length === 0) {
            progress.increment();
            return;
          }

          const shiftRows = shiftData.data
            .filter((s) => s.period > 0 && s.startTime && s.endTime && knownPlayerIds.has(s.playerId) && knownTeamIds.has(s.teamId))
            .map((s) => ({
              gameId: game.id,
              playerId: s.playerId,
              teamId: s.teamId,
              period: s.period,
              startSeconds: parseTimeToSeconds(s.startTime),
              endSeconds: parseTimeToSeconds(s.endTime),
            }));

          // Batch insert shifts
          const BATCH_SIZE = 500;
          for (let j = 0; j < shiftRows.length; j += BATCH_SIZE) {
            const chunk = shiftRows.slice(j, j + BATCH_SIZE);
            await db.insert(shifts).values(chunk).onConflictDoNothing();
          }

          // Mark game as shifts-ingested
          await db
            .update(games)
            .set({ shiftsIngested: true })
            .where(eq(games.id, game.id));

          totalShifts += shiftRows.length;
        } catch (err) {
          // Drizzle wraps postgres errors; the actual PG error is in err.cause
          type PgErr = Error & { detail?: string; code?: string };
          const asAny = err as unknown as Record<string, unknown>;
          const pgErr: PgErr | null = err instanceof Error && asAny.cause instanceof Error
            ? (asAny.cause as PgErr)
            : err instanceof Error ? (err as PgErr) : null;
          const reason = pgErr
            ? [pgErr.message, pgErr.detail, pgErr.code ? `[${pgErr.code}]` : ""].filter(Boolean).join(" — ")
            : String(err);
          console.warn(`\nWarning: Failed to ingest shifts for game ${game.id}: ${reason}`);
        }
        progress.increment();
      })
    );
  }
  progress.done();

  console.log(
    `\nDone! Inserted ${totalShifts} shift records (${htmlFallbackCount} games used HTML fallback).`
  );
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
