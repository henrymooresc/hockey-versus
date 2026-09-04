import {
  pgTable,
  integer,
  varchar,
  text,
  boolean,
  smallint,
  date,
  timestamp,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: integer("id").primaryKey(),
  abbrev: varchar("abbrev", { length: 3 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  logoUrl: text("logo_url"),
});

export const players = pgTable(
  "players",
  {
    id: integer("id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    position: varchar("position", { length: 2 }),
    shootsCatches: varchar("shoots_catches", { length: 1 }),
    headshotUrl: text("headshot_url"),
    birthDate: date("birth_date"),
    currentTeamId: integer("current_team_id").references(() => teams.id),
    sweaterNumber: smallint("sweater_number"),
    searchText: varchar("search_text", { length: 200 }),
  },
  (table) => [
    index("idx_players_search").on(table.searchText),
  ]
);

export const seasons = pgTable("seasons", {
  id: varchar("id", { length: 8 }).primaryKey(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  ingested: boolean("ingested").default(false).notNull(),
});

export const games = pgTable(
  "games",
  {
    id: integer("id").primaryKey(),
    seasonId: varchar("season_id", { length: 8 })
      .references(() => seasons.id)
      .notNull(),
    gameType: smallint("game_type").notNull(),
    gameDate: date("game_date").notNull(),
    homeTeamId: integer("home_team_id").references(() => teams.id),
    awayTeamId: integer("away_team_id").references(() => teams.id),
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    /**
     * Progress flags. Each records work that finished for this game, so a
     * re-run resumes from what completed rather than from when a script last
     * ran. A per-season timestamp cannot express that: a game that was not
     * final on its first scan ends up older than the next cutoff, and gets
     * skipped forever.
     */
    playersScanned: boolean("players_scanned").default(false).notNull(),
    shiftsIngested: boolean("shifts_ingested").default(false).notNull(),
    eventsIngested: boolean("events_ingested").default(false).notNull(),
  },
  (table) => [
    index("idx_games_season").on(table.seasonId, table.gameType),
  ]
);

/**
 * No surrogate key. The natural key below identifies a shift, and a serial id
 * cost 217MB of index that nothing pointed at.
 */
export const shifts = pgTable(
  "shifts",
  {
    gameId: integer("game_id")
      .references(() => games.id)
      .notNull(),
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    teamId: integer("team_id")
      .references(() => teams.id)
      .notNull(),
    period: smallint("period").notNull(),
    startSeconds: smallint("start_seconds").notNull(),
    endSeconds: smallint("end_seconds").notNull(),
  },
  (table) => [
    /** Per-game lookups: the post-game breakdown and compute:versus. */
    index("idx_shifts_game_player").on(table.gameId, table.playerId),
    /**
     * Per-player lookups, for team-history. Covering: team_id rides along so
     * the scan never touches the heap. Without it that route scanned all 9.8M
     * rows, because every other index leads with game_id.
     */
    index("idx_shifts_player_game").on(
      table.playerId,
      table.gameId,
      table.teamId
    ),
    uniqueIndex("uq_shifts_game_player_period_time").on(
      table.gameId,
      table.playerId,
      table.period,
      table.startSeconds,
      table.endSeconds
    ),
  ]
);

export const gameEvents = pgTable(
  "game_events",
  {
    gameId: integer("game_id")
      .references(() => games.id)
      .notNull(),
    eventId: integer("event_id"),
    period: smallint("period").notNull(),
    timeSeconds: smallint("time_seconds").notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    teamId: integer("team_id").references(() => teams.id),
    player1Id: integer("player1_id").references(() => players.id),
    player2Id: integer("player2_id").references(() => players.id),
    player3Id: integer("player3_id").references(() => players.id),

    /**
     * Fields lifted out of the NHL play-by-play `details` object.
     *
     * The raw object used to be kept whole, in a `details_json` column that
     * cost 643MB and that nothing read. Most of that was the key names, stored
     * again on all 3.4M rows. These columns hold the same information for
     * roughly a tenth of the space, and can be queried and indexed.
     *
     * Nothing scores on them yet. See TASKS.md for how to use them.
     */
    /** Rink coordinates. x spans -100..100, y spans -42..42. */
    xCoord: smallint("x_coord"),
    yCoord: smallint("y_coord"),
    /** Zone the event happened in: O, D or N. */
    zoneCode: varchar("zone_code", { length: 1 }),
    /** Shots and goals: wrist, slap, snap, tip-in, backhand, and so on. */
    shotType: varchar("shot_type", { length: 16 }),
    /** The goalie facing this shot. Present on 99.3% of shots and goals. */
    goalieInNetId: integer("goalie_in_net_id").references(() => players.id),
    /** Penalties: minutes served, the infraction, and MIN/MAJ/MIS. */
    penaltyMinutes: smallint("penalty_minutes"),
    penaltyDescKey: varchar("penalty_desc_key", { length: 64 }),
    penaltyTypeCode: varchar("penalty_type_code", { length: 4 }),
    /** Running score after a goal, and running shots after a shot. */
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    homeSog: smallint("home_sog"),
    awaySog: smallint("away_sog"),
    /** Why a shot missed or was blocked: wide-of-net, hit-crossbar, and so on. */
    reason: varchar("reason", { length: 24 }),
  },
  (table) => [
    uniqueIndex("uq_game_events_game_event").on(table.gameId, table.eventId),
    index("idx_events_game_time").on(
      table.gameId,
      table.period,
      table.timeSeconds
    ),
  ]
);

/** Keyed by the unique index below; a serial id added 110MB and served nothing. */
export const versusStats = pgTable(
  "versus_stats",
  {
    playerAId: integer("player_a_id")
      .references(() => players.id)
      .notNull(),
    playerBId: integer("player_b_id")
      .references(() => players.id)
      .notNull(),
    seasonId: varchar("season_id", { length: 8 })
      .references(() => seasons.id)
      .notNull(),
    /** NHL game_type: 2 = regular season, 3 = playoffs (preseason excluded) */
    gameType: smallint("game_type").notNull().default(2),
    sameTeam: boolean("same_team").notNull(),
    gamesShared: smallint("games_shared").notNull().default(0),
    toiSharedSeconds: integer("toi_shared_seconds").notNull().default(0),
    playerATeamId: integer("player_a_team_id").references(() => teams.id),
    playerBTeamId: integer("player_b_team_id").references(() => teams.id),
    // Goals
    goalsForA: smallint("goals_for_a").notNull().default(0),
    goalsAgainstA: smallint("goals_against_a").notNull().default(0),
    goalsForB: smallint("goals_for_b").notNull().default(0),
    goalsAgainstB: smallint("goals_against_b").notNull().default(0),
    // Shots
    shotsForA: smallint("shots_for_a").notNull().default(0),
    shotsAgainstA: smallint("shots_against_a").notNull().default(0),
    shotsForB: smallint("shots_for_b").notNull().default(0),
    shotsAgainstB: smallint("shots_against_b").notNull().default(0),
    // Hits
    hitsByA: smallint("hits_by_a").notNull().default(0),
    hitsByB: smallint("hits_by_b").notNull().default(0),
    // Blocks
    blocksByA: smallint("blocks_by_a").notNull().default(0),
    blocksByB: smallint("blocks_by_b").notNull().default(0),
    // Penalties
    penaltyMinutesA: smallint("penalty_minutes_a").notNull().default(0),
    penaltyMinutesB: smallint("penalty_minutes_b").notNull().default(0),
    /**
     * Penalty shots conceded to the other player. Separate from the minutes
     * because every one is recorded at zero minutes — the remedy is the free
     * shot, not time in the box — so a per-minute term scores them nothing.
     */
    penaltyShotsA: smallint("penalty_shots_a").notNull().default(0),
    penaltyShotsB: smallint("penalty_shots_b").notNull().default(0),
    // Faceoffs
    faceoffWinsA: smallint("faceoff_wins_a").notNull().default(0),
    faceoffWinsB: smallint("faceoff_wins_b").notNull().default(0),
    // Game record
    winsA: smallint("wins_a").notNull().default(0),
    winsB: smallint("wins_b").notNull().default(0),
    // Individual stats
    playerAGoals: smallint("player_a_goals").notNull().default(0),
    playerAAssists: smallint("player_a_assists").notNull().default(0),
    playerAShots: smallint("player_a_shots").notNull().default(0),
    playerBGoals: smallint("player_b_goals").notNull().default(0),
    playerBAssists: smallint("player_b_assists").notNull().default(0),
    playerBShots: smallint("player_b_shots").notNull().default(0),
    computedAt: timestamp("computed_at").defaultNow(),
  },
  (table) => [
    /**
     * The relationship is part of the key. A pair traded apart mid-season is
     * team-mates for some games and opponents for others, and one row cannot
     * hold both: the totals mix, and `sameTeam` can only describe one of them.
     * Splitting here keeps each relationship whole.
     */
    uniqueIndex("idx_versus_pair_season").on(
      table.playerAId,
      table.playerBId,
      table.seasonId,
      table.gameType,
      table.sameTeam
    ),
    index("idx_versus_player_a").on(table.playerAId, table.seasonId, table.gameType),
    index("idx_versus_player_b").on(table.playerBId, table.seasonId, table.gameType),
  ]
);

/**
 * Derived from `shifts` + `games` by `npm run compute:versus`.
 *
 * Counting a player's games straight from `shifts` needs a sequential scan of
 * 10M+ rows, which the player search cannot afford on every keystroke.
 */
export const playerSeasonTotals = pgTable(
  "player_season_totals",
  {
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    seasonId: varchar("season_id", { length: 8 })
      .references(() => seasons.id)
      .notNull(),
    /** NHL game_type: 2 = regular season, 3 = playoffs */
    gameType: smallint("game_type").notNull(),
    gamesPlayed: smallint("games_played").notNull(),
    /**
     * Ice time for the season, with each player's overlapping shifts merged
     * before they are summed.
     *
     * A plain `SUM(end_seconds - start_seconds)` is wrong here. The unique
     * index on `shifts` rejects identical rows but not overlapping ones, and
     * the HTML shift report fallback can produce a second, slightly different
     * interval for the same time on ice. `mergeIntervals` in `time-utils.ts`
     * exists for the same reason on the read path.
     *
     * `integer`, not `smallint`: a full season runs past 80,000 seconds.
     */
    toiSeconds: integer("toi_seconds").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.seasonId, table.gameType] }),
    index("idx_pst_season").on(table.seasonId, table.gameType),
  ]
);

/**
 * Season counting stats per player, derived from `game_events` by
 * `npm run compute:versus`.
 *
 * Separate from `player_season_totals` on purpose. That table is read by the
 * player search on every keystroke and stays narrow for it; this one is wider
 * and only team pages and the intensity baseline read it. The two share a key,
 * so a rate stat is a join away.
 *
 * No games-played column here, deliberately. Counting distinct games from
 * events undercounts: 3,872 player-seasons record events in fewer games than
 * they have shifts, by 1.6 games on average, because a quiet game produces no
 * countable event. Divide by `player_season_totals.games_played` instead —
 * every row here has a matching row there.
 *
 * Every definition matches `versus-engine.ts`. Phase 5 of the plan divides a
 * `versus_stats` observation by a baseline from this table, so a category that
 * counts differently in the two places yields a wrong ratio and no error.
 */
export const playerSeasonStats = pgTable(
  "player_season_stats",
  {
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    seasonId: varchar("season_id", { length: 8 })
      .references(() => seasons.id)
      .notNull(),
    /** NHL game_type: 2 = regular season, 3 = playoffs. Preseason is excluded. */
    gameType: smallint("game_type").notNull(),
    goals: smallint("goals").notNull().default(0),
    assists: smallint("assists").notNull().default(0),
    /**
     * Shot *attempts*: goals, shots on goal, missed shots and blocked shots,
     * every one credited to the shooter. This is what `versus-engine.ts`
     * counts in `playerAShots`, and the two must not drift apart.
     */
    shots: smallint("shots").notNull().default(0),
    hits: smallint("hits").notNull().default(0),
    blocks: smallint("blocks").notNull().default(0),
    penaltyMinutes: smallint("penalty_minutes").notNull().default(0),
    faceoffWins: smallint("faceoff_wins").notNull().default(0),
    faceoffLosses: smallint("faceoff_losses").notNull().default(0),
    /**
     * Goalie workload, from `game_events.goalie_in_net_id`, which names the
     * goalie facing each shot on 99.46% of them.
     *
     * `saves` counts shots on goal stopped and `goalsAgainst` those that went
     * in, so save percentage is `saves / (saves + goalsAgainst)`. Missed and
     * blocked shots are excluded: neither reaches the goalie, and counting
     * them would inflate every save percentage.
     *
     * Zero for every skater. Kept on this table rather than a goalie-only one
     * because the grain is identical and the search ranks both together.
     */
    saves: smallint("saves").notNull().default(0),
    goalsAgainst: smallint("goals_against").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.playerId, table.seasonId, table.gameType] }),
    index("idx_pss_season").on(table.seasonId, table.gameType),
  ]
);

/**
 * Which pairs of players seek each other out physically, derived from
 * `versus_stats` by `npm run compute:versus`.
 *
 * A player's hits on one opponent, against his own hit rate across every
 * opponent he shares ice with. Both sides must lift for the pair to rank, so
 * the score is the *lower* of the two — one player running at another is not
 * a rivalry, it is a hunt.
 *
 * The baseline has to be pair-directed, like the measurement. `versus-engine`
 * only records `hits_by_a` when A hit B specifically, so comparing it to a
 * season hit total — which covers every opponent at once — makes the ratio
 * centre near 0.18 instead of 1.
 *
 * **This measures targeting, not effort, and the distinction was measured
 * rather than assumed.** The original plan scored "does a player produce more
 * against this opponent". Split-half reliability across ten seasons put that
 * at r = 0.018 to 0.050 — statistically detectable, practically noise, so a
 * board built on it would have ranked almost nothing. The same test on hits
 * gives r = 0.231 at 48,674 pairs, 0.320 at 8,061 and 0.420 at 245, rising
 * with sample size the way a real effect does. Scoring against a particular
 * opponent is close to random; hitting one is a stable habit.
 */
export const targetingEntries = pgTable(
  "targeting_entries",
  {
    /** A season id, or "ALL" for every season combined. */
    seasonScope: varchar("season_scope", { length: 8 }).notNull(),
    /** "regular", "playoffs" or "both". */
    gameTypeScope: varchar("game_type_scope", { length: 8 }).notNull(),
    rank: smallint("rank").notNull(),
    playerAId: integer("player_a_id")
      .references(() => players.id)
      .notNull(),
    playerBId: integer("player_b_id")
      .references(() => players.id)
      .notNull(),
    /** The lower of the two lifts: both players must target the other. */
    targetingScore: real("targeting_score").notNull(),
    /** Each side's own lift, so a page can show who drives the pair. */
    liftA: real("lift_a").notNull(),
    liftB: real("lift_b").notNull(),
    hitsAOnB: smallint("hits_a_on_b").notNull().default(0),
    hitsBOnA: smallint("hits_b_on_a").notNull().default(0),
    gamesShared: integer("games_shared").notNull(),
    toiSharedSeconds: integer("toi_shared_seconds").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.seasonScope, table.gameTypeScope, table.rank],
    }),
    index("idx_targeting_players").on(table.playerAId, table.playerBId),
  ]
);

/**
 * Team-against-team intensity, derived from `versus_stats` + `games` by
 * `npm run compute:versus`.
 *
 * Precomputed for the same reason `leaderboard_entries` is: the rollup groups
 * every opponent pair row by team pair, which is a full scan of `versus_stats`
 * and measured 1.9s. No index avoids it, because the board needs all 496
 * matchups at once rather than one.
 *
 * The score is weighted volume per game between the two clubs, regressed
 * toward the league mean, so it reads on the same per-game scale as the player
 * score. Volume is summed across both sides of every pair, which is what makes
 * the A/B labels in `versus_stats` irrelevant here — they follow player id
 * order, so each club's players sit on both sides.
 *
 * Only team ids live here. Names and logos join at read time, matching
 * `leaderboard_entries`.
 *
 * **Trap.** A pair's `player_a_team_id` comes from their most recent shared
 * game in the partition rather than being summed, so a player traded
 * mid-season has every game in that season attributed to his newer club. The
 * error is bounded by how often that happens and is invisible at the all-time
 * scope, where it washes out.
 */
export const teamRivalryEntries = pgTable(
  "team_rivalry_entries",
  {
    /** A season id, or "ALL" for every season combined. */
    seasonScope: varchar("season_scope", { length: 8 }).notNull(),
    /** "regular", "playoffs" or "both". */
    gameTypeScope: varchar("game_type_scope", { length: 8 }).notNull(),
    rank: smallint("rank").notNull(),
    /** The lower team id, so a matchup has one row rather than two. */
    teamXId: integer("team_x_id")
      .references(() => teams.id)
      .notNull(),
    teamYId: integer("team_y_id")
      .references(() => teams.id)
      .notNull(),
    rivalryScore: real("rivalry_score").notNull(),
    /** Games the two clubs played each other in this scope. */
    gamesPlayed: integer("games_played").notNull(),
    /** Unweighted totals, so the UI can show what drove the score. */
    goals: integer("goals").notNull().default(0),
    hits: integer("hits").notNull().default(0),
    penaltyMinutes: integer("penalty_minutes").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [table.seasonScope, table.gameTypeScope, table.rank],
    }),
    index("idx_tre_teams").on(table.teamXId, table.teamYId),
  ]
);

/**
 * Derived from `versus_stats` by `npm run compute:versus`.
 *
 * Ranking on demand means summing 2.6M rows and scoring 260k+ pairs per
 * request. The scores come from `computePairRivalryScore`, so this table and
 * the rivals list always agree.
 *
 * Skater and goalie pairs rank on separate boards. The two formulas measure
 * different contests and do not share a scale, so one combined board buries
 * whichever side scores lower.
 *
 * Only player IDs live here. Names, teams and headshots join at read time, so
 * a trade shows up immediately without a rebuild.
 */
export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    /** A season id, or "ALL" for every season combined. */
    seasonScope: varchar("season_scope", { length: 8 }).notNull(),
    /** "regular", "playoffs" or "both". */
    gameTypeScope: varchar("game_type_scope", { length: 8 }).notNull(),
    /** "skater" for skater against skater, "goalie" for shooter against goalie. */
    pairKind: varchar("pair_kind", { length: 8 }).notNull(),
    rank: smallint("rank").notNull(),
    playerAId: integer("player_a_id")
      .references(() => players.id)
      .notNull(),
    playerBId: integer("player_b_id")
      .references(() => players.id)
      .notNull(),
    rivalryScore: real("rivalry_score").notNull(),
    gamesShared: integer("games_shared").notNull(),
    toiSharedSeconds: integer("toi_shared_seconds").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.seasonScope, table.gameTypeScope, table.pairKind, table.rank],
    }),
  ]
);
