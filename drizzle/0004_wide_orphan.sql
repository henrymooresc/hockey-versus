DROP INDEX "idx_versus_pair_season";--> statement-breakpoint
DROP INDEX "idx_versus_player_a";--> statement-breakpoint
DROP INDEX "idx_versus_player_b";--> statement-breakpoint
ALTER TABLE "versus_stats" ADD COLUMN "game_type" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_versus_pair_season" ON "versus_stats" USING btree ("player_a_id","player_b_id","season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_versus_player_a" ON "versus_stats" USING btree ("player_a_id","season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_versus_player_b" ON "versus_stats" USING btree ("player_b_id","season_id","game_type");