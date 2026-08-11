ALTER TABLE "game_events" ADD COLUMN "x_coord" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "y_coord" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "zone_code" varchar(1);--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "shot_type" varchar(16);--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "goalie_in_net_id" integer;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "penalty_minutes" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "penalty_desc_key" varchar(64);--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "penalty_type_code" varchar(4);--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "home_score" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "away_score" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "home_sog" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "away_sog" smallint;--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "reason" varchar(24);--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_goalie_in_net_id_players_id_fk" FOREIGN KEY ("goalie_in_net_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;