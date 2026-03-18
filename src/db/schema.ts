import {
  pgTable,
  integer,
  varchar,
  text,
  boolean,
  smallint,
  serial,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
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
    shiftsIngested: boolean("shifts_ingested").default(false).notNull(),
    eventsIngested: boolean("events_ingested").default(false).notNull(),
  },
  (table) => [
    index("idx_games_season").on(table.seasonId, table.gameType),
  ]
);

export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
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
    shiftNumber: smallint("shift_number"),
  },
  (table) => [
    index("idx_shifts_game_player").on(table.gameId, table.playerId),
    index("idx_shifts_game_period").on(
      table.gameId,
      table.period,
      table.startSeconds,
      table.endSeconds
    ),
  ]
);

export const gameEvents = pgTable(
  "game_events",
  {
    id: serial("id").primaryKey(),
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
    detailsJson: jsonb("details_json"),
  },
  (table) => [
    index("idx_events_game_time").on(
      table.gameId,
      table.period,
      table.timeSeconds
    ),
    index("idx_events_type").on(table.eventType),
  ]
);

export const versusStats = pgTable(
  "versus_stats",
  {
    id: serial("id").primaryKey(),
    playerAId: integer("player_a_id")
      .references(() => players.id)
      .notNull(),
    playerBId: integer("player_b_id")
      .references(() => players.id)
      .notNull(),
    seasonId: varchar("season_id", { length: 8 })
      .references(() => seasons.id)
      .notNull(),
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
    // Penalties
    penaltiesByA: smallint("penalties_by_a").notNull().default(0),
    penaltiesByB: smallint("penalties_by_b").notNull().default(0),
    // Faceoffs
    faceoffWinsA: smallint("faceoff_wins_a").notNull().default(0),
    faceoffWinsB: smallint("faceoff_wins_b").notNull().default(0),
    // Individual stats
    playerAGoals: smallint("player_a_goals").notNull().default(0),
    playerAAssists: smallint("player_a_assists").notNull().default(0),
    playerBGoals: smallint("player_b_goals").notNull().default(0),
    playerBAssists: smallint("player_b_assists").notNull().default(0),
    computedAt: timestamp("computed_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_versus_pair_season").on(
      table.playerAId,
      table.playerBId,
      table.seasonId
    ),
    index("idx_versus_player_a").on(table.playerAId, table.seasonId),
    index("idx_versus_player_b").on(table.playerBId, table.seasonId),
  ]
);
