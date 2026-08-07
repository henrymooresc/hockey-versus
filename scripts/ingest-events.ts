/**
 * Fetches play-by-play data for all games and populates the `game_events` table.
 *
 * Usage: npx tsx scripts/ingest-events.ts [--seasons 20242025,20232024] [--game 2016020294,2016020322]
 * Default: current season only.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, inArray } from "drizzle-orm";
import { games, gameEvents, players, teams } from "../src/db/schema";
import { getPlayByPlay, setFetchImpl } from "../src/lib/nhl-api";
import { rateLimitedFetch } from "./lib/rate-limiter";
import { parseTimeToSeconds } from "../src/lib/time-utils";
import { Progress } from "./lib/progress";
import { parseTargetSeasons } from "./lib/seasons";

setFetchImpl(rateLimitedFetch);
import type { Play } from "../src/types/nhl-api";

const targetSeasons = parseTargetSeasons();

// --game 2016020294,2016020322  (comma-separated, targets specific games regardless of seasons filter)
const gameIdFilter = (() => {
  const val = process.argv.find((_, i, a) => a[i - 1] === "--game");
  return val ? val.split(",").map(Number) : null;
})();

const CONCURRENCY = 5;

// Map NHL typeDescKey to our normalized event types
const EVENT_TYPE_MAP: Record<string, string> = {
  goal: "goal",
  "shot-on-goal": "shot",
  "missed-shot": "missed_shot",
  "blocked-shot": "blocked_shot",
  hit: "hit",
  faceoff: "faceoff",
  penalty: "penalty",
  giveaway: "giveaway",
  takeaway: "takeaway",
};

function normalizeEvent(play: Play) {
  const eventType = EVENT_TYPE_MAP[play.typeDescKey];
  if (!eventType) return null;

  const d = play.details;
  let player1Id: number | null = null;
  let player2Id: number | null = null;
  let player3Id: number | null = null;
  const teamId: number | null = d?.eventOwnerTeamId ?? null;

  switch (eventType) {
    case "goal":
      player1Id = d?.scoringPlayerId ?? null;
      player2Id = d?.assist1PlayerId ?? null;
      player3Id = d?.assist2PlayerId ?? null;
      break;
    case "shot":
    case "missed_shot":
      player1Id = d?.shootingPlayerId ?? null;
      break;
    case "blocked_shot":
      player1Id = d?.shootingPlayerId ?? null;
      player2Id = d?.blockingPlayerId ?? null;
      break;
    case "hit":
      player1Id = d?.hittingPlayerId ?? null;
      player2Id = d?.hitteePlayerId ?? null;
      break;
    case "faceoff":
      player1Id = d?.winningPlayerId ?? null;
      player2Id = d?.losingPlayerId ?? null;
      break;
    case "penalty":
      player1Id = d?.committedByPlayerId ?? null;
      player2Id = d?.drawnByPlayerId ?? null;
      break;
    case "giveaway":
    case "takeaway":
      player1Id = d?.playerId ?? null;
      break;
  }

  // Lift the useful parts of `details` into typed columns. Storing the object
  // whole cost 643MB, most of it the key names repeated on every row.
  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  const str = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v);

  return {
    eventId: play.eventId,
    period: play.periodDescriptor.number,
    timeSeconds: parseTimeToSeconds(play.timeInPeriod),
    eventType,
    teamId,
    player1Id,
    player2Id,
    player3Id,
    xCoord: num(d?.xCoord),
    yCoord: num(d?.yCoord),
    zoneCode: str(d?.zoneCode),
    shotType: str(d?.shotType),
    goalieInNetId: num(d?.goalieInNetId),
    penaltyMinutes: num(d?.duration),
    penaltyDescKey: str(d?.descKey),
    penaltyTypeCode: str(d?.typeCode),
    homeScore: num(d?.homeScore),
    awayScore: num(d?.awayScore),
    homeSog: num(d?.homeSOG),
    awaySog: num(d?.awaySOG),
    reason: str(d?.reason),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  const filtered = await db
    .select({ id: games.id, seasonId: games.seasonId })
    .from(games)
    .where(
      gameIdFilter
        ? inArray(games.id, gameIdFilter)
        : and(eq(games.eventsIngested, false), inArray(games.seasonId, targetSeasons))
    );

  const filterDesc = gameIdFilter
    ? `games ${gameIdFilter.join(", ")}`
    : `seasons: ${targetSeasons.join(", ")}`;
  console.log(`${filtered.length} games need event ingestion (${filterDesc})`);

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

  const sanitizePlayer = (id: number | null) =>
    id !== null && knownPlayerIds.has(id) ? id : null;
  const sanitizeTeam = (id: number | null) =>
    id !== null && knownTeamIds.has(id) ? id : null;

  const progress = new Progress(filtered.length, "Ingesting events");
  let totalEvents = 0;

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const batch = filtered.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (game) => {
        try {
          const pbp = await getPlayByPlay(game.id);

          const eventRows = pbp.plays
            .map(normalizeEvent)
            .filter((e): e is NonNullable<typeof e> => e !== null)
            .map((e) => ({
              ...e,
              gameId: game.id,
              teamId: sanitizeTeam(e.teamId),
              player1Id: sanitizePlayer(e.player1Id),
              player2Id: sanitizePlayer(e.player2Id),
              player3Id: sanitizePlayer(e.player3Id),
            }));

          // Batch insert
          const BATCH_SIZE = 500;
          for (let j = 0; j < eventRows.length; j += BATCH_SIZE) {
            const chunk = eventRows.slice(j, j + BATCH_SIZE);
            await db.insert(gameEvents).values(chunk).onConflictDoNothing();
          }

          await db
            .update(games)
            .set({ eventsIngested: true })
            .where(eq(games.id, game.id));

          totalEvents += eventRows.length;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // 403: API explicitly blocks access (e.g. old seasons not supported)
          // 404: game data doesn't exist (e.g. postponed/rescheduled game with no PBP)
          // Both are permanent — mark done so we don't retry on every future run.
          // Other errors (network drops, 5xx, 429 exhausted) stay pending for retry.
          const isPermanent =
            /NHL API error: 403/.test(msg) || /NHL API error: 404/.test(msg);
          if (isPermanent) {
            console.warn(`\nSkipping game ${game.id} permanently (${msg})`);
            await db
              .update(games)
              .set({ eventsIngested: true })
              .where(eq(games.id, game.id));
          } else {
            console.warn(`\nWarning: Failed to ingest events for game ${game.id}: ${msg}`);
          }
        }
        progress.increment();
      })
    );
  }
  progress.done();

  console.log(`\nDone! Inserted ${totalEvents} event records.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
