--> Order matters here. The backfill has to read details_json before it is
--> dropped, and the duplicate purge has to run while the serial id still
--> exists and before the unique index is created.

--> 1. Remove exact duplicate events. uq_game_events_game_event was declared in
--> the schema but never applied, so onConflictDoNothing in ingest-events had
--> nothing to conflict against and a re-run inserted every event twice. The
--> survivors are the lowest id of each pair; the rows are otherwise identical.
DELETE FROM "game_events" a
USING "game_events" b
WHERE a."id" > b."id"
  AND a."game_id" = b."game_id"
  AND a."event_id" = b."event_id";--> statement-breakpoint

--> 2. Lift the useful fields out of the raw object into the typed columns
--> added by the previous migration. On a fresh database this is a no-op,
--> because ingest-events now writes the columns directly.
UPDATE "game_events" SET
  "x_coord"           = ("details_json"->>'xCoord')::smallint,
  "y_coord"           = ("details_json"->>'yCoord')::smallint,
  "zone_code"         = "details_json"->>'zoneCode',
  "shot_type"         = "details_json"->>'shotType',
  "goalie_in_net_id"  = ("details_json"->>'goalieInNetId')::integer,
  "penalty_minutes"   = ("details_json"->>'duration')::smallint,
  "penalty_desc_key"  = "details_json"->>'descKey',
  "penalty_type_code" = "details_json"->>'typeCode',
  "home_score"        = ("details_json"->>'homeScore')::smallint,
  "away_score"        = ("details_json"->>'awayScore')::smallint,
  "home_sog"          = ("details_json"->>'homeSOG')::smallint,
  "away_sog"          = ("details_json"->>'awaySOG')::smallint,
  "reason"            = "details_json"->>'reason'
WHERE "details_json" IS NOT NULL;--> statement-breakpoint

--> 3. Drop the raw object and the dead weight.
--> details_json cost 643MB, mostly the key names repeated on 3.4M rows.
--> The three serial ids carried 400MB of index and no foreign key referenced
--> any of them. idx_shifts_game_period and idx_events_type were never scanned
--> while exercising every route.
DROP INDEX "idx_events_type";--> statement-breakpoint
DROP INDEX "idx_shifts_game_period";--> statement-breakpoint
ALTER TABLE "game_events" DROP COLUMN "details_json";--> statement-breakpoint
ALTER TABLE "game_events" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN "shift_number";--> statement-breakpoint
ALTER TABLE "versus_stats" DROP COLUMN "id";--> statement-breakpoint

--> 4. Create the index that should have existed all along, so duplicates
--> cannot come back on the next ingest.
CREATE UNIQUE INDEX "uq_game_events_game_event" ON "game_events" ("game_id","event_id");
