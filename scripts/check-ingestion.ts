/**
 * Fails when a game that has already been played is still missing shifts or
 * events.
 *
 * The daily workflow needs this. Its previous shape could skip every step and
 * still report success, so a broken pipeline would have looked healthy right
 * up to the point somebody noticed the site had stopped updating.
 *
 * A game counts as played when it has a score and its date has passed. Both
 * halves matter:
 *
 * - `ingest:seasons` inserts the whole schedule, so games that have not been
 *   played yet sit in `games` with both flags false. They are not a fault.
 * - The date guard leaves a day of slack for a game that finishes late, or for
 *   a run that happens while a game is still on.
 *
 * Usage: npx tsx scripts/check-ingestion.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { unwrapRows } from "../src/lib/db-utils";
import { createScriptDb } from "./lib/db";

interface IncompleteRow {
  id: number;
  season_id: string;
  game_date: string;
  shifts_ingested: boolean;
  events_ingested: boolean;
}

interface CountRow {
  played: number;
  complete: number;
  scheduled: number;
}

async function main() {
  const { client, db } = createScriptDb();

  const summary = unwrapRows<CountRow>(
    await db.execute(sql`
      SELECT
        count(*) FILTER (
          WHERE home_score IS NOT NULL AND game_date < CURRENT_DATE
        )::int AS played,
        count(*) FILTER (
          WHERE home_score IS NOT NULL AND game_date < CURRENT_DATE
            AND shifts_ingested AND events_ingested
        )::int AS complete,
        count(*) FILTER (WHERE home_score IS NULL)::int AS scheduled
      FROM games
    `)
  )[0];

  const incomplete = unwrapRows<IncompleteRow>(
    await db.execute(sql`
      SELECT id, season_id, game_date, shifts_ingested, events_ingested
      FROM games
      WHERE home_score IS NOT NULL
        AND game_date < CURRENT_DATE
        AND (shifts_ingested = false OR events_ingested = false)
      ORDER BY game_date DESC
      LIMIT 25
    `)
  );

  console.log(
    `Played games: ${summary.played} — complete: ${summary.complete}, ` +
      `incomplete: ${summary.played - summary.complete}`
  );
  console.log(`Scheduled but not yet played: ${summary.scheduled}`);

  await client.end();

  if (incomplete.length === 0) {
    console.log("\nIngestion is complete for every game that has been played.");
    return;
  }

  console.error(
    `\nFAIL: ${summary.played - summary.complete} played game(s) are missing ` +
      `shifts or events. First ${incomplete.length}:`
  );
  for (const g of incomplete) {
    const missing = [
      g.shifts_ingested ? null : "shifts",
      g.events_ingested ? null : "events",
    ]
      .filter(Boolean)
      .join(" and ");
    console.error(`  ${g.id}  ${g.game_date}  season ${g.season_id}  missing ${missing}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
