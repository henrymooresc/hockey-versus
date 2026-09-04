CREATE TABLE "team_rivalry_entries" (
	"season_scope" varchar(8) NOT NULL,
	"game_type_scope" varchar(8) NOT NULL,
	"rank" smallint NOT NULL,
	"team_x_id" integer NOT NULL,
	"team_y_id" integer NOT NULL,
	"rivalry_score" real NOT NULL,
	"games_played" integer NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"penalty_minutes" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "team_rivalry_entries_season_scope_game_type_scope_rank_pk" PRIMARY KEY("season_scope","game_type_scope","rank")
);
--> statement-breakpoint
ALTER TABLE "team_rivalry_entries" ADD CONSTRAINT "team_rivalry_entries_team_x_id_teams_id_fk" FOREIGN KEY ("team_x_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rivalry_entries" ADD CONSTRAINT "team_rivalry_entries_team_y_id_teams_id_fk" FOREIGN KEY ("team_y_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tre_teams" ON "team_rivalry_entries" USING btree ("team_x_id","team_y_id");