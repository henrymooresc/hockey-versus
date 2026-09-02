CREATE TABLE "player_season_stats" (
	"player_id" integer NOT NULL,
	"season_id" varchar(8) NOT NULL,
	"game_type" smallint NOT NULL,
	"goals" smallint DEFAULT 0 NOT NULL,
	"assists" smallint DEFAULT 0 NOT NULL,
	"shots" smallint DEFAULT 0 NOT NULL,
	"hits" smallint DEFAULT 0 NOT NULL,
	"blocks" smallint DEFAULT 0 NOT NULL,
	"penalty_minutes" smallint DEFAULT 0 NOT NULL,
	"faceoff_wins" smallint DEFAULT 0 NOT NULL,
	"faceoff_losses" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "player_season_stats_player_id_season_id_game_type_pk" PRIMARY KEY("player_id","season_id","game_type")
);
--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pss_season" ON "player_season_stats" USING btree ("season_id","game_type");