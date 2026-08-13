/**
 * Computes versus stats from shifts + events data and populates versus_stats.
 *
 * Usage: npx tsx scripts/compute-versus.ts [--seasons 20242025,20232024]
 * Default: current season only.
 */
import "dotenv/config";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and, or, lt, isNull, sql, inArray } from "drizzle-orm";
import { games, shifts, gameEvents, versusStats, leaderboardEntries } from "../src/db/schema";
import { unwrapRows } from "../src/lib/db-utils";
import {
  computeGameVersus,
  type ShiftRecord,
  type EventRecord,
  type PairStats,
} from "../src/lib/versus-engine";
import {
  computePairRivalryScore,
  type SkaterRivalryInput,
} from "../src/lib/rivalry-score";
import { Progress } from "./lib/progress";
import { parseTargetSeasons } from "./lib/seasons";
import { createScriptDb } from "./lib/db";

const targetSeasons = parseTargetSeasons();

/** One pair's totals for a single season and game type. */
type AccumulatedPair = PairStats & {
  seasonId: string;
  gameType: number;
  gamesShared: number;
  winsA: number;
  winsB: number;
};

/**
 * Writes one partition's pairs to `versus_stats` and reports how many.
 *
 * The upsert replaces every column rather than adding to it, so a partition can
 * be recomputed and rewritten safely. That is what lets the caller flush at each
 * partition boundary instead of holding the whole run in memory.
 */
async function flushPairs(
  db: PostgresJsDatabase,
  accumulator: Map<string, AccumulatedPair>,
  runStartedAt: Date
): Promise<number> {
  const entries = Array.from(accumulator.values());
  const BATCH_SIZE = 100;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((row) => ({
      playerAId: row.playerAId,
      playerBId: row.playerBId,
      seasonId: row.seasonId,
      gameType: row.gameType,
      sameTeam: row.sameTeam,
      gamesShared: row.gamesShared,
      toiSharedSeconds: row.toiSharedSeconds,
      winsA: row.winsA,
      winsB: row.winsB,
      playerATeamId: row.playerATeamId,
      playerBTeamId: row.playerBTeamId,
      goalsForA: row.goalsForA,
      goalsAgainstA: row.goalsAgainstA,
      goalsForB: row.goalsForB,
      goalsAgainstB: row.goalsAgainstB,
      shotsForA: row.shotsForA,
      shotsAgainstA: row.shotsAgainstA,
      shotsForB: row.shotsForB,
      shotsAgainstB: row.shotsAgainstB,
      hitsByA: row.hitsByA,
      hitsByB: row.hitsByB,
      blocksByA: row.blocksByA,
      blocksByB: row.blocksByB,
      penaltyMinutesA: row.penaltyMinutesA,
      penaltyMinutesB: row.penaltyMinutesB,
      faceoffWinsA: row.faceoffWinsA,
      faceoffWinsB: row.faceoffWinsB,
      playerAGoals: row.playerAGoals,
      playerAAssists: row.playerAAssists,
      playerAShots: row.playerAShots,
      playerBGoals: row.playerBGoals,
      playerBAssists: row.playerBAssists,
      playerBShots: row.playerBShots,
      // Stamped from one clock for the whole run, on both the insert and the
      // update path. `deleteOrphans` compares against this exact value, and the
      // column's `defaultNow()` would otherwise stamp inserts from the database
      // clock while updates came from this process.
      computedAt: runStartedAt,
    }));

    // Single insert per batch using excluded pseudo-table for conflict resolution
    await db
      .insert(versusStats)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          versusStats.playerAId,
          versusStats.playerBId,
          versusStats.seasonId,
          versusStats.gameType,
          versusStats.sameTeam,
        ],
        set: {
          gamesShared: sql`excluded.games_shared`,
          toiSharedSeconds: sql`excluded.toi_shared_seconds`,
          winsA: sql`excluded.wins_a`,
          winsB: sql`excluded.wins_b`,
          playerATeamId: sql`excluded.player_a_team_id`,
          playerBTeamId: sql`excluded.player_b_team_id`,
          goalsForA: sql`excluded.goals_for_a`,
          goalsAgainstA: sql`excluded.goals_against_a`,
          goalsForB: sql`excluded.goals_for_b`,
          goalsAgainstB: sql`excluded.goals_against_b`,
          shotsForA: sql`excluded.shots_for_a`,
          shotsAgainstA: sql`excluded.shots_against_a`,
          shotsForB: sql`excluded.shots_for_b`,
          shotsAgainstB: sql`excluded.shots_against_b`,
          hitsByA: sql`excluded.hits_by_a`,
          hitsByB: sql`excluded.hits_by_b`,
          blocksByA: sql`excluded.blocks_by_a`,
          blocksByB: sql`excluded.blocks_by_b`,
          penaltyMinutesA: sql`excluded.penalty_minutes_a`,
          penaltyMinutesB: sql`excluded.penalty_minutes_b`,
          faceoffWinsA: sql`excluded.faceoff_wins_a`,
          faceoffWinsB: sql`excluded.faceoff_wins_b`,
          playerAGoals: sql`excluded.player_a_goals`,
          playerAAssists: sql`excluded.player_a_assists`,
          playerAShots: sql`excluded.player_a_shots`,
          playerBGoals: sql`excluded.player_b_goals`,
          playerBAssists: sql`excluded.player_b_assists`,
          playerBShots: sql`excluded.player_b_shots`,
          computedAt: runStartedAt,
        },
      });
  }

  return entries.length;
}

/**
 * Removes rows in this partition that the run did not write.
 *
 * The upsert refreshes rows it produces but has no way to notice one it no
 * longer produces, so a pair the engine stops emitting kept its row forever. A
 * full recompute on 2026-08-12 found 830 such rows in 2023-24 and 799 in
 * 2024-25, all single-game pairs, against none in the season that had been
 * computed most recently.
 *
 * Every row the run wrote carries `runStartedAt`, so anything older belongs to
 * an earlier computation of the same partition. `IS NULL` is included because
 * the column is nullable and a null would fail the comparison and survive.
 *
 * The caller only invokes this after a partition has written rows. Without that
 * guard a partition that produced nothing — a bug, or shifts that failed to
 * load — would delete the season instead of leaving it alone.
 */
async function deleteOrphans(
  db: PostgresJsDatabase,
  seasonId: string,
  gameType: number,
  runStartedAt: Date
): Promise<number> {
  const removed = await db
    .delete(versusStats)
    .where(
      and(
        eq(versusStats.seasonId, seasonId),
        eq(versusStats.gameType, gameType),
        or(
          isNull(versusStats.computedAt),
          lt(versusStats.computedAt, runStartedAt)
        )
      )
    )
    .returning({ playerAId: versusStats.playerAId });

  return removed.length;
}

/**
 * Rebuilds `player_season_totals` from `shifts` + `games`.
 *
 * The rebuild covers every season, not just the target ones, because the whole
 * scan costs about 5 seconds. A transaction keeps the table readable
 * throughout, so a live search never sees an empty table.
 */
async function refreshPlayerSeasonTotals(db: PostgresJsDatabase) {
  console.log("\nRebuilding player_season_totals...");
  const started = Date.now();

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM player_season_totals`);
    await tx.execute(sql`
      INSERT INTO player_season_totals (player_id, season_id, game_type, games_played)
      SELECT s.player_id, g.season_id, g.game_type, COUNT(DISTINCT s.game_id)
      FROM shifts s
      JOIN games g ON g.id = s.game_id
      GROUP BY s.player_id, g.season_id, g.game_type
    `);
  });

  const rows = await db.execute(sql`SELECT COUNT(*)::int AS n FROM player_season_totals`);
  const count = unwrapRows<{ n: number }>(rows)[0]?.n ?? 0;
  console.log(`Done! ${count} rows in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

/** Matches the cap that `/api/leaderboard` allows on its `limit` parameter. */
const LEADERBOARD_SIZE = 200;
/** Shared ice time below this is noise, not a rivalry. */
const LEADERBOARD_MIN_TOI = 1800;
const GAME_TYPE_SCOPES = ["regular", "playoffs", "both"] as const;
const PAIR_KINDS = ["skater", "goalie"] as const;
type PairKind = (typeof PAIR_KINDS)[number];

/** Shape of one scored pair, before it gets a rank. */
interface ScoredPair {
  playerAId: number;
  playerBId: number;
  rivalryScore: number;
  gamesShared: number;
  toiSharedSeconds: number;
}

interface LeaderboardPairRow extends SkaterRivalryInput {
  player_a_id: number;
  player_b_id: number;
  position_a: string | null;
  position_b: string | null;
  toiSharedSeconds: number;
  [key: string]: unknown;
}

/**
 * Rebuilds `leaderboard_entries` for every season scope and game type.
 *
 * One aggregate runs per combination, so the cost grows with the season count
 * rather than with the request count.
 */
async function refreshLeaderboard(db: PostgresJsDatabase) {
  console.log("\nRebuilding leaderboard_entries...");
  const started = Date.now();

  const seasonRows = await db.execute(
    sql`SELECT id FROM seasons WHERE ingested = true ORDER BY id DESC`
  );
  const seasonIds = unwrapRows<{ id: string }>(seasonRows).map((r) => r.id);
  const seasonScopes: string[] = ["ALL", ...seasonIds];

  const rows: (typeof leaderboardEntries.$inferInsert)[] = [];

  for (const seasonScope of seasonScopes) {
    for (const gameTypeScope of GAME_TYPE_SCOPES) {
      const gameTypeSql =
        gameTypeScope === "regular"
          ? sql`AND v.game_type = 2`
          : gameTypeScope === "playoffs"
            ? sql`AND v.game_type = 3`
            : sql``;
      const seasonSql =
        seasonScope === "ALL" ? sql`` : sql`AND v.season_id = ${seasonScope}`;

      const pairRows = await db.execute(sql`
        SELECT
          v.player_a_id,
          v.player_b_id,
          pa.position AS position_a,
          pb.position AS position_b,
          SUM(v.toi_shared_seconds)::int AS "toiSharedSeconds",
          SUM(v.games_shared)::int AS "gamesShared",
          SUM(v.hits_by_a)::int AS "hitsByA",
          SUM(v.hits_by_b)::int AS "hitsByB",
          SUM(v.blocks_by_a)::int AS "blocksByA",
          SUM(v.blocks_by_b)::int AS "blocksByB",
          SUM(v.penalty_minutes_a)::int AS "penaltyMinutesA",
          SUM(v.penalty_minutes_b)::int AS "penaltyMinutesB",
          SUM(v.faceoff_wins_a)::int AS "faceoffWinsA",
          SUM(v.faceoff_wins_b)::int AS "faceoffWinsB",
          SUM(v.player_a_goals)::int AS "playerAGoals",
          SUM(v.player_a_assists)::int AS "playerAAssists",
          SUM(v.player_a_shots)::int AS "playerAShots",
          SUM(v.player_b_goals)::int AS "playerBGoals",
          SUM(v.player_b_assists)::int AS "playerBAssists",
          SUM(v.player_b_shots)::int AS "playerBShots",
          SUM(v.wins_a)::int AS "winsA",
          SUM(v.wins_b)::int AS "winsB"
        FROM versus_stats v
        JOIN players pa ON pa.id = v.player_a_id
        JOIN players pb ON pb.id = v.player_b_id
        WHERE v.same_team = false
          AND v.toi_shared_seconds > 0
          ${seasonSql}
          ${gameTypeSql}
        GROUP BY v.player_a_id, v.player_b_id, pa.position, pb.position
        HAVING SUM(v.toi_shared_seconds) >= ${LEADERBOARD_MIN_TOI}
      `);

      // Skater and goalie pairs rank separately. The goalie formula measures a
      // different contest and does not share a scale with the skater one, so a
      // combined board buries whichever side scores lower.
      const byKind: Record<PairKind, ScoredPair[]> = {
        skater: [],
        goalie: [],
      };

      for (const row of unwrapRows<LeaderboardPairRow>(pairRows)) {
        const aIsGoalie = row.position_a === "G";
        const bIsGoalie = row.position_b === "G";
        // Two goalies never share the ice, so there is no contest to rank.
        if (aIsGoalie && bIsGoalie) continue;

        byKind[aIsGoalie || bIsGoalie ? "goalie" : "skater"].push({
          playerAId: row.player_a_id,
          playerBId: row.player_b_id,
          rivalryScore: computePairRivalryScore({
            ...row,
            positionA: row.position_a,
            positionB: row.position_b,
          }),
          gamesShared: row.gamesShared,
          toiSharedSeconds: row.toiSharedSeconds,
        });
      }

      for (const pairKind of PAIR_KINDS) {
        byKind[pairKind]
          .sort((a, b) => b.rivalryScore - a.rivalryScore)
          .slice(0, LEADERBOARD_SIZE)
          .forEach((entry, i) => {
            rows.push({ seasonScope, gameTypeScope, pairKind, rank: i + 1, ...entry });
          });
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM leaderboard_entries`);
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await tx.insert(leaderboardEntries).values(rows.slice(i, i + BATCH));
    }
  });

  console.log(
    `Done! ${rows.length} rows across ${seasonScopes.length} season scopes ` +
      `and ${PAIR_KINDS.length} pair kinds in ${((Date.now() - started) / 1000).toFixed(1)}s.`
  );
}

async function main() {
  const { client, db } = createScriptDb();

  // Get games that have both shifts and events ingested, for target seasons.
  // Only regular season (gameType=2) and playoffs (gameType=3) — skip preseason.
  //
  // The order matters and is not cosmetic. A pair's stored team ids and
  // `sameTeam` come from one game rather than being summed, so without an
  // explicit order Postgres decides which game wins and the result changes with
  // the physical row layout. Two databases holding identical data produced
  // different rows because of this. Oldest first, so the last game processed
  // for a pair is the most recent one.
  const filtered = await db
    .select({
      id: games.id,
      seasonId: games.seasonId,
      gameType: games.gameType,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
    })
    .from(games)
    .where(
      and(
        eq(games.shiftsIngested, true),
        eq(games.eventsIngested, true),
        inArray(games.seasonId, targetSeasons),
        inArray(games.gameType, [2, 3])
      )
    )
    // `id` breaks ties, since several games share a date.
    .orderBy(games.gameDate, games.id);

  console.log(
    `Computing versus stats for ${filtered.length} games (seasons: ${targetSeasons.join(", ")})`
  );

  if (filtered.length === 0) {
    console.log("No new versus stats to compute.");
    // The derived tables still read `shifts` and `versus_stats`, which an
    // earlier run may have changed.
    await refreshPlayerSeasonTotals(db);
    await refreshLeaderboard(db);
    await client.end();
    return;
  }

  /**
   * Partition the games by season and game type, then compute and write one
   * partition at a time.
   *
   * The accumulator key already carries the season and the game type, so a pair
   * never merges across a partition boundary. Flushing at each boundary writes
   * exactly the rows one big pass would, while holding only the largest single
   * partition in memory instead of every season at once. A full 10-season run
   * used to build about 2.6M objects before writing anything.
   *
   * A run that fails midway now leaves earlier partitions written. That is safe:
   * the upsert replaces whole rows, so a re-run corrects them.
   */
  const partitions = new Map<string, typeof filtered>();
  for (const game of filtered) {
    const key = `${game.seasonId}-${game.gameType}`;
    const bucket = partitions.get(key);
    if (bucket) bucket.push(game);
    else partitions.set(key, [game]);
  }

  // Process in chunks to avoid loading all shifts+events into memory at once
  const GAME_CHUNK = 500;

  // One clock for the whole run. Every row written carries this, so anything
  // older in a partition the run covered is a row it no longer produces.
  const runStartedAt = new Date();

  let totalUpserted = 0;
  let totalRemoved = 0;
  let largestPartition = 0;

  for (const key of Array.from(partitions.keys()).sort()) {
    const partitionGames = partitions.get(key)!;
    const gameTypeLabel = partitionGames[0].gameType === 3 ? "playoffs" : "regular";
    console.log(
      `\nSeason ${partitionGames[0].seasonId} ${gameTypeLabel}: ${partitionGames.length} games`
    );

    const accumulator = new Map<string, AccumulatedPair>();
    const progress = new Progress(partitionGames.length, "  Computing");

    for (let gi = 0; gi < partitionGames.length; gi += GAME_CHUNK) {
      const chunk = partitionGames.slice(gi, gi + GAME_CHUNK);
      const chunkIds = chunk.map((g) => g.id);

      const [chunkShifts, chunkEvents] = await Promise.all([
        db
          .select({
            gameId: shifts.gameId,
            playerId: shifts.playerId,
            teamId: shifts.teamId,
            period: shifts.period,
            startSeconds: shifts.startSeconds,
            endSeconds: shifts.endSeconds,
          })
          .from(shifts)
          .where(inArray(shifts.gameId, chunkIds)),
        db
          .select({
            gameId: gameEvents.gameId,
            eventType: gameEvents.eventType,
            period: gameEvents.period,
            timeSeconds: gameEvents.timeSeconds,
            teamId: gameEvents.teamId,
            player1Id: gameEvents.player1Id,
            player2Id: gameEvents.player2Id,
            player3Id: gameEvents.player3Id,
            penaltyMinutes: gameEvents.penaltyMinutes,
          })
          .from(gameEvents)
          .where(inArray(gameEvents.gameId, chunkIds)),
      ]);

      const shiftsByGame = new Map<number, ShiftRecord[]>();
      for (const s of chunkShifts) {
        if (!shiftsByGame.has(s.gameId)) shiftsByGame.set(s.gameId, []);
        shiftsByGame.get(s.gameId)!.push(s as ShiftRecord);
      }

      const eventsByGame = new Map<number, EventRecord[]>();
      for (const e of chunkEvents) {
        if (!eventsByGame.has(e.gameId)) eventsByGame.set(e.gameId, []);
        eventsByGame.get(e.gameId)!.push(e as EventRecord);
      }

      for (const game of chunk) {
        try {
          const gameShifts = shiftsByGame.get(game.id) ?? [];
          const gameEvts = eventsByGame.get(game.id) ?? [];

          if (gameShifts.length === 0) {
            progress.increment();
            continue;
          }

          const pairStats = computeGameVersus(gameShifts, gameEvts);

          // Determine game winner team ID
          const winnerTeamId =
            game.homeScore !== null && game.awayScore !== null && game.homeScore !== game.awayScore
              ? game.homeScore > game.awayScore
                ? game.homeTeamId
                : game.awayTeamId
              : null;

          // Accumulate into (season, gameType, relationship)-level stats.
          //
          // `sameTeam` is in the key because a pair traded apart plays some
          // games together and some against each other, and those are two
          // different relationships. Folding them into one row mixed the totals
          // and put linemates on the opponent leaderboard.
          for (const [pairKey, stats] of pairStats) {
            const accKey = `${pairKey}-${game.seasonId}-${game.gameType}-${stats.sameTeam}`;

            const pairWinsA = winnerTeamId === stats.playerATeamId ? 1 : 0;
            const pairWinsB = winnerTeamId === stats.playerBTeamId ? 1 : 0;

            if (!accumulator.has(accKey)) {
              accumulator.set(accKey, {
                ...stats,
                seasonId: game.seasonId,
                gameType: game.gameType,
                gamesShared: 1,
                winsA: pairWinsA,
                winsB: pairWinsB,
              });
            } else {
              const existing = accumulator.get(accKey)!;
              existing.gamesShared++;
              existing.winsA += pairWinsA;
              existing.winsB += pairWinsB;

              // These describe a state, not a total, so they take the most
              // recent game rather than accumulating. Games arrive oldest
              // first, so the last write wins.
              //
              // `sameTeam` is no longer set here: it is part of the accumulator
              // key, so it is already constant across every game in this row.
              // The team ids still need the rule, for a player who moves twice
              // and so has two clubs within one relationship.
              existing.playerATeamId = stats.playerATeamId;
              existing.playerBTeamId = stats.playerBTeamId;

              existing.toiSharedSeconds += stats.toiSharedSeconds;
              existing.goalsForA += stats.goalsForA;
              existing.goalsAgainstA += stats.goalsAgainstA;
              existing.goalsForB += stats.goalsForB;
              existing.goalsAgainstB += stats.goalsAgainstB;
              existing.shotsForA += stats.shotsForA;
              existing.shotsAgainstA += stats.shotsAgainstA;
              existing.shotsForB += stats.shotsForB;
              existing.shotsAgainstB += stats.shotsAgainstB;
              existing.hitsByA += stats.hitsByA;
              existing.hitsByB += stats.hitsByB;
              existing.blocksByA += stats.blocksByA;
              existing.blocksByB += stats.blocksByB;
              existing.penaltyMinutesA += stats.penaltyMinutesA;
              existing.penaltyMinutesB += stats.penaltyMinutesB;
              existing.faceoffWinsA += stats.faceoffWinsA;
              existing.faceoffWinsB += stats.faceoffWinsB;
              existing.playerAGoals += stats.playerAGoals;
              existing.playerAAssists += stats.playerAAssists;
              existing.playerAShots += stats.playerAShots;
              existing.playerBGoals += stats.playerBGoals;
              existing.playerBAssists += stats.playerBAssists;
              existing.playerBShots += stats.playerBShots;
            }
          }
        } catch (err) {
          console.warn(
            `\nWarning: Failed to compute versus for game ${game.id}: ${err instanceof Error ? err.message : err}`
          );
        }
        progress.increment();
      }
    }
    progress.done();

    // Write this partition and drop it before the next one is built. This is
    // the whole point of the partitioning: peak memory is one season and game
    // type, not the entire run.
    largestPartition = Math.max(largestPartition, accumulator.size);
    const written = await flushPairs(db, accumulator, runStartedAt);
    totalUpserted += written;
    accumulator.clear();
    console.log(`  Upserted ${written.toLocaleString()} pair records`);

    // Only after the partition has written something. See `deleteOrphans`.
    if (written > 0) {
      const removed = await deleteOrphans(
        db,
        partitionGames[0].seasonId,
        partitionGames[0].gameType,
        runStartedAt
      );
      totalRemoved += removed;
      if (removed > 0) {
        console.log(`  Removed ${removed.toLocaleString()} rows this run no longer produces`);
      }
    }
  }

  console.log(
    `\nDone! Upserted ${totalUpserted.toLocaleString()} versus stat records ` +
      `across ${partitions.size} partition(s), removed ${totalRemoved.toLocaleString()}. ` +
      `Peak accumulator held ${largestPartition.toLocaleString()} pairs.`
  );

  await refreshPlayerSeasonTotals(db);
  await refreshLeaderboard(db);
  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
