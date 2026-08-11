--> Emptied first: leaderboard_entries is derived, and `npm run compute:versus`
--> rebuilds every row. That lets pair_kind be NOT NULL with no invented default.
DELETE FROM "leaderboard_entries";--> statement-breakpoint
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT "leaderboard_entries_season_scope_game_type_scope_rank_pk";--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "pair_kind" varchar(8) NOT NULL;--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_season_scope_game_type_scope_pair_kind_rank_pk" PRIMARY KEY("season_scope","game_type_scope","pair_kind","rank");
