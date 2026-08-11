CREATE TABLE "game_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"event_id" integer,
	"period" smallint NOT NULL,
	"time_seconds" smallint NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"team_id" integer,
	"player1_id" integer,
	"player2_id" integer,
	"player3_id" integer,
	"details_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" integer PRIMARY KEY NOT NULL,
	"season_id" varchar(8) NOT NULL,
	"game_type" smallint NOT NULL,
	"game_date" date NOT NULL,
	"home_team_id" integer,
	"away_team_id" integer,
	"home_score" smallint,
	"away_score" smallint,
	"shifts_ingested" boolean DEFAULT false NOT NULL,
	"events_ingested" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"season_scope" varchar(8) NOT NULL,
	"game_type_scope" varchar(8) NOT NULL,
	"rank" smallint NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"rivalry_score" real NOT NULL,
	"games_shared" integer NOT NULL,
	"toi_shared_seconds" integer NOT NULL,
	CONSTRAINT "leaderboard_entries_season_scope_game_type_scope_rank_pk" PRIMARY KEY("season_scope","game_type_scope","rank")
);
--> statement-breakpoint
CREATE TABLE "player_season_totals" (
	"player_id" integer NOT NULL,
	"season_id" varchar(8) NOT NULL,
	"game_type" smallint NOT NULL,
	"games_played" smallint NOT NULL,
	CONSTRAINT "player_season_totals_player_id_season_id_game_type_pk" PRIMARY KEY("player_id","season_id","game_type")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"position" varchar(2),
	"shoots_catches" varchar(1),
	"headshot_url" text,
	"birth_date" date,
	"current_team_id" integer,
	"sweater_number" smallint,
	"search_text" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" varchar(8) PRIMARY KEY NOT NULL,
	"start_date" date,
	"end_date" date,
	"ingested" boolean DEFAULT false NOT NULL,
	"last_games_ingested_at" timestamp,
	"last_players_scanned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"period" smallint NOT NULL,
	"start_seconds" smallint NOT NULL,
	"end_seconds" smallint NOT NULL,
	"shift_number" smallint
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY NOT NULL,
	"abbrev" varchar(3) NOT NULL,
	"name" varchar(100) NOT NULL,
	"logo_url" text
);
--> statement-breakpoint
CREATE TABLE "versus_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"season_id" varchar(8) NOT NULL,
	"game_type" smallint DEFAULT 2 NOT NULL,
	"same_team" boolean NOT NULL,
	"games_shared" smallint DEFAULT 0 NOT NULL,
	"toi_shared_seconds" integer DEFAULT 0 NOT NULL,
	"player_a_team_id" integer,
	"player_b_team_id" integer,
	"goals_for_a" smallint DEFAULT 0 NOT NULL,
	"goals_against_a" smallint DEFAULT 0 NOT NULL,
	"goals_for_b" smallint DEFAULT 0 NOT NULL,
	"goals_against_b" smallint DEFAULT 0 NOT NULL,
	"shots_for_a" smallint DEFAULT 0 NOT NULL,
	"shots_against_a" smallint DEFAULT 0 NOT NULL,
	"shots_for_b" smallint DEFAULT 0 NOT NULL,
	"shots_against_b" smallint DEFAULT 0 NOT NULL,
	"hits_by_a" smallint DEFAULT 0 NOT NULL,
	"hits_by_b" smallint DEFAULT 0 NOT NULL,
	"blocks_by_a" smallint DEFAULT 0 NOT NULL,
	"blocks_by_b" smallint DEFAULT 0 NOT NULL,
	"penalties_by_a" smallint DEFAULT 0 NOT NULL,
	"penalties_by_b" smallint DEFAULT 0 NOT NULL,
	"faceoff_wins_a" smallint DEFAULT 0 NOT NULL,
	"faceoff_wins_b" smallint DEFAULT 0 NOT NULL,
	"wins_a" smallint DEFAULT 0 NOT NULL,
	"wins_b" smallint DEFAULT 0 NOT NULL,
	"player_a_goals" smallint DEFAULT 0 NOT NULL,
	"player_a_assists" smallint DEFAULT 0 NOT NULL,
	"player_a_shots" smallint DEFAULT 0 NOT NULL,
	"player_b_goals" smallint DEFAULT 0 NOT NULL,
	"player_b_assists" smallint DEFAULT 0 NOT NULL,
	"player_b_shots" smallint DEFAULT 0 NOT NULL,
	"rivalry_score" real,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_player3_id_players_id_fk" FOREIGN KEY ("player3_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_totals" ADD CONSTRAINT "player_season_totals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_totals" ADD CONSTRAINT "player_season_totals_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_current_team_id_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versus_stats" ADD CONSTRAINT "versus_stats_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versus_stats" ADD CONSTRAINT "versus_stats_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versus_stats" ADD CONSTRAINT "versus_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versus_stats" ADD CONSTRAINT "versus_stats_player_a_team_id_teams_id_fk" FOREIGN KEY ("player_a_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versus_stats" ADD CONSTRAINT "versus_stats_player_b_team_id_teams_id_fk" FOREIGN KEY ("player_b_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_game_events_game_event" ON "game_events" USING btree ("game_id","event_id");--> statement-breakpoint
CREATE INDEX "idx_events_game_time" ON "game_events" USING btree ("game_id","period","time_seconds");--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "game_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_games_season" ON "games" USING btree ("season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_pst_season" ON "player_season_totals" USING btree ("season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_players_search" ON "players" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "idx_shifts_game_player" ON "shifts" USING btree ("game_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_shifts_game_period" ON "shifts" USING btree ("game_id","period","start_seconds","end_seconds");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shifts_game_player_period_time" ON "shifts" USING btree ("game_id","player_id","period","start_seconds","end_seconds");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_versus_pair_season" ON "versus_stats" USING btree ("player_a_id","player_b_id","season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_versus_player_a" ON "versus_stats" USING btree ("player_a_id","season_id","game_type");--> statement-breakpoint
CREATE INDEX "idx_versus_player_b" ON "versus_stats" USING btree ("player_b_id","season_id","game_type");