/**
 * Fetches play-by-play data for all games and populates the `game_events` table.
 *
 * Usage: npx tsx scripts/ingest-events.ts [--season 20242025]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { games, gameEvents, players, teams } from "../src/db/schema";
import { getPlayByPlay } from "../src/lib/nhl-api";
import { parseTimeToSeconds } from "../src/lib/time-utils";
import { Progress } from "./lib/progress";
import type { Play } from "../src/types/nhl-api";

const seasonFilter = process.argv.find(
  (_, i, a) => a[i - 1] === "--season"
);

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
  let teamId: number | null = d?.eventOwnerTeamId ?? null;

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
      player1Id = d?.playerId ?? (d as any)?.playerId ?? null;
      break;
  }

  return {
    eventId: play.eventId,
    period: play.periodDescriptor.number,
    timeSeconds: parseTimeToSeconds(play.timeInPeriod),
    eventType,
    teamId,
    player1Id,
    player2Id,
    player3Id,
    detailsJson: d ?? null,
  };
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  const pendingGames = await db
    .select({ id: games.id, seasonId: games.seasonId })
    .from(games)
    .where(eq(games.eventsIngested, false));

  const filtered = seasonFilter
    ? pendingGames.filter((g) => g.seasonId === seasonFilter)
    : pendingGames;

  console.log(
    `${filtered.length} games need event ingestion${seasonFilter ? ` (season ${seasonFilter})` : ""}`
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

  const sanitizePlayer = (id: number | null) =>
    id !== null && knownPlayerIds.has(id) ? id : null;
  const sanitizeTeam = (id: number | null) =>
    id !== null && knownTeamIds.has(id) ? id : null;

  const progress = new Progress(filtered.length, "Ingesting events");
  let totalEvents = 0;

  for (const game of filtered) {
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
      for (let i = 0; i < eventRows.length; i += BATCH_SIZE) {
        const batch = eventRows.slice(i, i + BATCH_SIZE);
        await db.insert(gameEvents).values(batch);
      }

      await db
        .update(games)
        .set({ eventsIngested: true })
        .where(eq(games.id, game.id));

      totalEvents += eventRows.length;
    } catch (err) {
      console.warn(
        `\nWarning: Failed to ingest events for game ${game.id}: ${err instanceof Error ? err.message : err}`
      );
    }
    progress.increment();
  }
  progress.done();

  console.log(`\nDone! Inserted ${totalEvents} event records.`);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
