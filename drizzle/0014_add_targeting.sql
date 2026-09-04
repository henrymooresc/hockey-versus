CREATE TABLE "targeting_entries" (
	"season_scope" varchar(8) NOT NULL,
	"game_type_scope" varchar(8) NOT NULL,
	"rank" smallint NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"targeting_score" real NOT NULL,
	"lift_a" real NOT NULL,
	"lift_b" real NOT NULL,
	"hits_a_on_b" smallint DEFAULT 0 NOT NULL,
	"hits_b_on_a" smallint DEFAULT 0 NOT NULL,
	"games_shared" integer NOT NULL,
	"toi_shared_seconds" integer NOT NULL,
	CONSTRAINT "targeting_entries_season_scope_game_type_scope_rank_pk" PRIMARY KEY("season_scope","game_type_scope","rank")
);
--> statement-breakpoint
ALTER TABLE "targeting_entries" ADD CONSTRAINT "targeting_entries_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targeting_entries" ADD CONSTRAINT "targeting_entries_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_targeting_players" ON "targeting_entries" USING btree ("player_a_id","player_b_id");