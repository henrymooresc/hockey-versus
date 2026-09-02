/**
 * Re-derives PRIOR_VOLUME_PER_GAME and GOALIE_PRIOR_VOLUME_PER_GAME.
 *
 * Run after any change to the category weights or to what versus_stats holds,
 * and paste the pooled means into `src/lib/rivalry-score.ts`. A prior that no
 * longer matches the weights pulls every pair toward a mean the formula cannot
 * produce, which quietly favours small samples — the exact bias the regression
 * exists to remove.
 *
 * Uses exactly the pool refreshLeaderboard ranks: opponent pairs only, regular
 * season, summed across every ingested season, above the 1800-second floor.
 * Recompute every season first, or the untouched ones sit at zero and drag the
 * mean down.
 *
 * Usage: npm run derive:priors
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { unwrapRows } from "../src/lib/db-utils";
import { createScriptDb } from "./lib/db";

const W = { points: 5, pim: 2, penaltyShots: 6, hits: 3, blocks: 2, shots: 1 };
const GW = { goals: 8, assists: 4, shots: 1 };

interface Row {
  position_a: string | null;
  position_b: string | null;
  gamesShared: number;
  hitsByA: number; hitsByB: number;
  blocksByA: number; blocksByB: number;
  penaltyMinutesA: number; penaltyMinutesB: number;
  penaltyShotsA: number; penaltyShotsB: number;
  playerAGoals: number; playerAAssists: number; playerAShots: number;
  playerBGoals: number; playerBAssists: number; playerBShots: number;
  [key: string]: unknown;
}

async function main() {
  const { client, db } = createScriptDb();

  const rows = unwrapRows<Row>(
    await db.execute(sql`
      SELECT pa.position AS position_a, pb.position AS position_b,
             SUM(v.games_shared)::int AS "gamesShared",
             SUM(v.hits_by_a)::int AS "hitsByA", SUM(v.hits_by_b)::int AS "hitsByB",
             SUM(v.blocks_by_a)::int AS "blocksByA", SUM(v.blocks_by_b)::int AS "blocksByB",
             SUM(v.penalty_minutes_a)::int AS "penaltyMinutesA",
             SUM(v.penalty_minutes_b)::int AS "penaltyMinutesB",
             SUM(v.penalty_shots_a)::int AS "penaltyShotsA",
             SUM(v.penalty_shots_b)::int AS "penaltyShotsB",
             SUM(v.player_a_goals)::int AS "playerAGoals",
             SUM(v.player_a_assists)::int AS "playerAAssists",
             SUM(v.player_a_shots)::int AS "playerAShots",
             SUM(v.player_b_goals)::int AS "playerBGoals",
             SUM(v.player_b_assists)::int AS "playerBAssists",
             SUM(v.player_b_shots)::int AS "playerBShots"
      FROM versus_stats v
      JOIN players pa ON pa.id = v.player_a_id
      JOIN players pb ON pb.id = v.player_b_id
      WHERE v.same_team = false AND v.toi_shared_seconds > 0 AND v.game_type = 2
      GROUP BY v.player_a_id, v.player_b_id, pa.position, pb.position
      HAVING SUM(v.toi_shared_seconds) >= 1800
    `)
  );

  let sVol = 0, sGames = 0, sN = 0, sUnweighted = 0;
  let gVol = 0, gGames = 0, gN = 0, gUnweighted = 0;

  for (const r of rows) {
    const aG = r.position_a === "G", bG = r.position_b === "G";
    if (aG && bG) continue;
    if (r.gamesShared === 0) continue;

    if (aG || bG) {
      const skaterIsA = bG;
      const shots = skaterIsA ? r.playerAShots : r.playerBShots;
      const goals = skaterIsA ? r.playerAGoals : r.playerBGoals;
      const assists = skaterIsA ? r.playerAAssists : r.playerBAssists;
      if (shots === 0) continue; // goalieVolumeAndBalance bails here
      const vol = GW.shots * shots + GW.goals * goals + GW.assists * assists;
      gVol += vol; gGames += r.gamesShared; gN++;
      gUnweighted += vol / r.gamesShared;
    } else {
      const vol =
        W.points * (r.playerAGoals + r.playerAAssists + r.playerBGoals + r.playerBAssists) +
        W.pim * (r.penaltyMinutesA + r.penaltyMinutesB) +
        W.penaltyShots * (r.penaltyShotsA + r.penaltyShotsB) +
        W.hits * (r.hitsByA + r.hitsByB) +
        W.blocks * (r.blocksByA + r.blocksByB) +
        W.shots * (r.playerAShots + r.playerBShots);
      sVol += vol; sGames += r.gamesShared; sN++;
      sUnweighted += vol / r.gamesShared;
    }
  }

  console.log(`Skater pairs: ${sN.toLocaleString()}`);
  console.log(`  pooled mean volume/game: ${(sVol / sGames).toFixed(3)}`);
  console.log(`  unweighted mean:         ${(sUnweighted / sN).toFixed(3)}`);
  console.log(`Goalie pairs: ${gN.toLocaleString()}`);
  console.log(`  pooled mean volume/game: ${(gVol / gGames).toFixed(3)}`);
  console.log(`  unweighted mean:         ${(gUnweighted / gN).toFixed(3)}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
