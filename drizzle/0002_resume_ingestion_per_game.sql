ALTER TABLE "games" ADD COLUMN "players_scanned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
--> Games with shifts already ingested had their rosters resolved: every shift
--> references a known player. Without this, the next players run would refetch
--> all 13k boxscores. On a fresh database no game has shifts yet, so this is a
--> no-op there.
UPDATE "games" SET "players_scanned" = true WHERE "shifts_ingested" = true;--> statement-breakpoint
--> IF EXISTS because migration 0003 of the old chain was generated but never
--> applied, so these columns are absent from databases built by push and
--> present in ones built from the squashed baseline.
ALTER TABLE "seasons" DROP COLUMN IF EXISTS "last_games_ingested_at";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN IF EXISTS "last_players_scanned_at";
