export interface SkaterRivalryInput {
  toiSharedSeconds: number;
  gamesShared: number;
  hitsByA: number;
  hitsByB: number;
  blocksByA: number;
  blocksByB: number;
  penaltyMinutesA: number;
  penaltyMinutesB: number;
  penaltyShotsA: number;
  penaltyShotsB: number;
  faceoffWinsA: number;
  faceoffWinsB: number;
  playerAGoals: number;
  playerAAssists: number;
  playerAShots: number;
  playerBGoals: number;
  playerBAssists: number;
  playerBShots: number;
  winsA: number;
  winsB: number;
}

export interface GoalieRivalryInput {
  toiSharedSeconds: number;
  gamesShared: number;
  /** Skater's individual shots on this goalie */
  skaterShots: number;
  /** Skater's goals scored on this goalie */
  skaterGoals: number;
  /** Skater's assists on goals scored on this goalie while sharing ice */
  skaterAssists: number;
  winsA: number;
  winsB: number;
}

function computeBalance(categories: [number, number][]): number {
  let activeCount = 0;
  let balanceSum = 0;

  for (const [a, b] of categories) {
    const total = a + b;
    if (total === 0) continue;
    activeCount++;
    balanceSum += 1 - Math.abs(a - b) / total;
  }

  if (activeCount === 0) return 0;
  return balanceSum / activeCount;
}

const BALANCE_FLOOR = 0.5;

const CATEGORY_WEIGHTS = {
  points: 5,
  /**
   * Per penalty *minute*, not per penalty. A 2-minute minor still contributes
   * 4, exactly as the old per-penalty weight of 4 did, so the common case is
   * unchanged. Severity is what this buys: a 5-minute fight now contributes
   * 10, and a 10-minute misconduct 20.
   */
  penaltyMinutes: 2,
  /**
   * A penalty shot conceded, scored per event rather than per minute.
   *
   * These carry no minutes — all 426 in ten seasons are recorded at zero,
   * because the remedy is the free shot rather than time in the box — so
   * under a per-minute term the harshest individual foul in hockey scored
   * exactly nothing. 6 places it above a 2-minute minor at 4 and below a
   * fight at 10.
   *
   * Volume only. It is deliberately absent from the balance categories
   * below: all 393 pairs that have a penalty shot between them have exactly
   * one, so the category is always 1-0, the most imbalanced a category can
   * be. In the balance average it would contribute 0 and pull the multiplier
   * down, cancelling the volume it just earned. This is the faceoff rule
   * inverted — faceoffs are balance-only because they measure opportunity;
   * penalty shots are volume-only because they can never balance.
   */
  penaltyShots: 6,
  hits: 3,
  blocks: 2,
  shots: 1,
};

/**
 * Faceoffs have no weight here on purpose, and it is not an oversight.
 *
 * Only a centre takes draws, so counting them as volume paid one position for
 * turning up. They were 34.9% of the weighted volume of an opposing centre
 * pair against 0.2% for a pair with no centre, and the all-time skater board
 * came out 189 centre-against-centre pairs in its top 200, from a pool 9.0%
 * C-C. Cutting the weight did not fix it — even at 0.25 the board was still
 * 59 of 200 — because the term scales with opportunity rather than contest.
 *
 * They stay in the balance categories below. `versus-engine.ts` only counts a
 * draw when the pair *is* the faceoff, so `faceoffWinsA + faceoffWinsB` is the
 * number of draws between exactly these two players, and
 * `1 - |a - b| / (a + b)` is their win split. That says something real about
 * two centres being evenly matched, and it costs nothing: keeping it moved the
 * board by two places out of 200.
 */

const GOALIE_CATEGORY_WEIGHTS = {
  goals: 8,
  assists: 4,
  shots: 1,
};

/**
 * Splits the skater score into its two parts, so the raw and the regressed
 * forms below can share one definition of volume and balance.
 * Returns null when the pair never shared the ice.
 */
function skaterVolumeAndBalance(
  input: SkaterRivalryInput
): { weightedVolume: number; multiplier: number } | null {
  if (input.toiSharedSeconds === 0) return null;
  if (input.gamesShared === 0) return null;

  const ptsA = input.playerAGoals + input.playerAAssists;
  const ptsB = input.playerBGoals + input.playerBAssists;

  const weightedVolume =
    CATEGORY_WEIGHTS.points * (ptsA + ptsB) +
    CATEGORY_WEIGHTS.penaltyMinutes * (input.penaltyMinutesA + input.penaltyMinutesB) +
    CATEGORY_WEIGHTS.penaltyShots * (input.penaltyShotsA + input.penaltyShotsB) +
    CATEGORY_WEIGHTS.hits * (input.hitsByA + input.hitsByB) +
    CATEGORY_WEIGHTS.blocks * (input.blocksByA + input.blocksByB) +
    CATEGORY_WEIGHTS.shots * (input.playerAShots + input.playerBShots);

  const categories: [number, number][] = [
    [ptsA, ptsB],
    [input.penaltyMinutesA, input.penaltyMinutesB],
    [input.hitsByA, input.hitsByB],
    [input.blocksByA, input.blocksByB],
    [input.faceoffWinsA, input.faceoffWinsB],
    [input.playerAShots, input.playerBShots],
  ];

  const balance = computeBalance(categories);
  const multiplier = BALANCE_FLOOR + (1 - BALANCE_FLOOR) * balance;

  return { weightedVolume, multiplier };
}

/**
 * Raw per-game intensity, with no correction for sample size.
 *
 * Use this only to describe a known set of games, such as one game in the
 * post-game breakdown or a point on the rivalry trend chart. To rank pairs
 * against each other, call `computePairRivalryScore` instead.
 */
export function computeSkaterRivalryScore(input: SkaterRivalryInput): number {
  const parts = skaterVolumeAndBalance(input);
  if (!parts) return 0;
  return (parts.weightedVolume / input.gamesShared) * parts.multiplier;
}

/**
 * League mean weighted volume per game for skater pairs, measured over all 10
 * seasons of regular-season data above the 1800-second noise floor. The pooled
 * mean is 5.362 and the unweighted mean 5.365, across 186,094 pairs.
 *
 * Re-derive this after a large data change, or after changing any category
 * weight — it must match the weights above or the regression pulls toward a
 * mean the formula cannot produce, which quietly favours small samples. It fell
 * from 5.67 on 2026-08-12 when faceoffs left the volume sum and `versus_stats`
 * split team-mate rows from opponent rows.
 *
 * Recompute *every* season first: `compute:versus` defaults to the current one,
 * so a partial run leaves the other nine at zero and skews the mean.
 *
 * Re-derived 2026-08-28 after the shootout exclusion, the zero-minute penalty
 * fix and the new `penaltyShots` weight: pooled 5.362, unweighted 5.366, the
 * same 186,094 pairs. Unchanged at this precision, and that is a result rather
 * than an oversight — the three changes together touch about 0.2% of pairs.
 */
const PRIOR_VOLUME_PER_GAME = 5.36;

/**
 * The same figure for goalie pairs, measured the same way. The pooled mean is
 * 5.492 and the unweighted mean 5.366, across 71,487 pairs. Faceoffs never
 * entered this formula, so the move from 5.472 is the row split alone.
 *
 * That it lands so close to the skater figure is the point: both formulas
 * describe interactions per game, so their scores belong on one scale.
 *
 * Re-derived 2026-08-28 alongside the skater prior: pooled 5.492, unweighted
 * 5.366, the same 71,487 pairs. The shootout exclusion barely reaches this
 * pool — only 5 shootout shots had an opposing goalie on the ice, because
 * shift charts record the shooters and almost never the goalie.
 */
const GOALIE_PRIOR_VOLUME_PER_GAME = 5.49;

/**
 * Games of league-average play credited to every pair before its own record
 * carries more weight than the prior. Roughly three seasons of head-to-head
 * meetings. A pair below this count is a small sample.
 *
 * One figure covers both formulas, because the NHL schedule decides how often
 * any two players meet, whatever their positions.
 */
export const PRIOR_GAMES = 10;

/**
 * True when the prior still outweighs the pair's own record.
 * The UI marks these rows so a short history is visible in the ranking.
 */
export function isSmallSample(gamesShared: number): boolean {
  return gamesShared < PRIOR_GAMES;
}

/**
 * Per-game intensity pulled toward the league mean, by an amount that falls as
 * shared games rise.
 *
 * Pairs with one or two shared games score about twice the league mean, which
 * is noise rather than intensity. Without this correction a two-game sample
 * outranks a decade-long rivalry. Genuinely intense short histories still rank
 * highly; they just need more than a couple of games to prove it.
 */
function computeRegressedSkaterScore(input: SkaterRivalryInput): number {
  const parts = skaterVolumeAndBalance(input);
  if (!parts) return 0;

  const regressedAverage =
    (parts.weightedVolume + PRIOR_GAMES * PRIOR_VOLUME_PER_GAME) /
    (input.gamesShared + PRIOR_GAMES);

  return regressedAverage * parts.multiplier;
}

export interface PairRivalryInput extends SkaterRivalryInput {
  positionA: string | null;
  positionB: string | null;
}

/**
 * Picks the right formula for a pair and returns its ranking score.
 *
 * Every ranking caller must use this rather than the formulas below. A second
 * dispatch site lets the leaderboard and the rivals list drift apart, which
 * shows the same pair two different scores.
 *
 * Both formulas regress toward their league mean, so a short history cannot
 * outrank a long one on noise alone.
 */
export function computePairRivalryScore(input: PairRivalryInput): number {
  const aIsGoalie = input.positionA === "G";
  const bIsGoalie = input.positionB === "G";

  // Two goalies never share the ice, so there is no rivalry to score.
  if (aIsGoalie && bIsGoalie) return 0;

  if (aIsGoalie || bIsGoalie) {
    const skaterIsA = bIsGoalie;
    return computeRegressedGoalieScore({
      toiSharedSeconds: input.toiSharedSeconds,
      gamesShared: input.gamesShared,
      skaterShots: skaterIsA ? input.playerAShots : input.playerBShots,
      skaterGoals: skaterIsA ? input.playerAGoals : input.playerBGoals,
      skaterAssists: skaterIsA ? input.playerAAssists : input.playerBAssists,
      winsA: input.winsA,
      winsB: input.winsB,
    });
  }

  return computeRegressedSkaterScore(input);
}

/**
 * Splits the goalie score into its two parts, mirroring the skater helper.
 * Returns null when there is no contest to measure.
 */
function goalieVolumeAndBalance(
  input: GoalieRivalryInput
): { weightedVolume: number; multiplier: number } | null {
  if (input.toiSharedSeconds === 0) return null;
  if (input.gamesShared === 0) return null;
  if (input.skaterShots === 0) return null;

  // Weighted volume of meaningful interactions: every shot is a contest, every
  // goal or assist while sharing ice is a beat against this goalie.
  const weightedVolume =
    GOALIE_CATEGORY_WEIGHTS.shots * input.skaterShots +
    GOALIE_CATEGORY_WEIGHTS.goals * input.skaterGoals +
    GOALIE_CATEGORY_WEIGHTS.assists * input.skaterAssists;

  // Balance: goals scored vs saves made (with a floor so a dominant goalie
  // still gets credit for facing a high-volume shooter), plus team result.
  const saves = input.skaterShots - input.skaterGoals;
  const balance = computeBalance([
    [input.skaterGoals, saves],
    [input.winsA, input.winsB],
  ]);
  const multiplier = BALANCE_FLOOR + (1 - BALANCE_FLOOR) * balance;

  return { weightedVolume, multiplier };
}

/**
 * Raw per-game intensity for a shooter against a goalie, with no correction
 * for sample size. The skater counterpart is `computeSkaterRivalryScore`, and
 * the same rule applies: use this to describe a known set of games, and use
 * `computePairRivalryScore` to rank pairs against each other.
 */
export function computeGoalieRivalryScore(input: GoalieRivalryInput): number {
  const parts = goalieVolumeAndBalance(input);
  if (!parts) return 0;
  return (parts.weightedVolume / input.gamesShared) * parts.multiplier;
}

/**
 * The goalie counterpart to `computeRegressedSkaterScore`.
 *
 * Goalie means hold steady across sample sizes, because shots are frequent and
 * predictable. The tail does not: pairs with one to three shared games reach
 * almost double the per-game maximum of long histories, and a leaderboard shows
 * exactly that tail. Regression handles it without letting scores grow forever
 * with career length.
 */
function computeRegressedGoalieScore(input: GoalieRivalryInput): number {
  const parts = goalieVolumeAndBalance(input);
  if (!parts) return 0;

  const regressedAverage =
    (parts.weightedVolume + PRIOR_GAMES * GOALIE_PRIOR_VOLUME_PER_GAME) /
    (input.gamesShared + PRIOR_GAMES);

  return regressedAverage * parts.multiplier;
}
