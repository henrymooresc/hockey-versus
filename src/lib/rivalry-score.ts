export interface SkaterRivalryInput {
  toiSharedSeconds: number;
  gamesShared: number;
  hitsByA: number;
  hitsByB: number;
  blocksByA: number;
  blocksByB: number;
  penaltiesByA: number;
  penaltiesByB: number;
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
  penalties: 4,
  hits: 3,
  blocks: 2,
  faceoffs: 1.5,
  shots: 1,
};

const GOALIE_CATEGORY_WEIGHTS = {
  goals: 8,
  assists: 4,
  shots: 1,
};

export function computeSkaterRivalryScore(input: SkaterRivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;
  if (input.gamesShared === 0) return 0;

  const ptsA = input.playerAGoals + input.playerAAssists;
  const ptsB = input.playerBGoals + input.playerBAssists;

  const weightedVolume =
    CATEGORY_WEIGHTS.points * (ptsA + ptsB) +
    CATEGORY_WEIGHTS.penalties * (input.penaltiesByA + input.penaltiesByB) +
    CATEGORY_WEIGHTS.hits * (input.hitsByA + input.hitsByB) +
    CATEGORY_WEIGHTS.blocks * (input.blocksByA + input.blocksByB) +
    CATEGORY_WEIGHTS.faceoffs * (input.faceoffWinsA + input.faceoffWinsB) +
    CATEGORY_WEIGHTS.shots * (input.playerAShots + input.playerBShots);

  const avgWeightedVolume = weightedVolume / input.gamesShared;

  const categories: [number, number][] = [
    [ptsA, ptsB],
    [input.penaltiesByA, input.penaltiesByB],
    [input.hitsByA, input.hitsByB],
    [input.blocksByA, input.blocksByB],
    [input.faceoffWinsA, input.faceoffWinsB],
    [input.playerAShots, input.playerBShots],
  ];

  const balance = computeBalance(categories);
  const multiplier = BALANCE_FLOOR + (1 - BALANCE_FLOOR) * balance;

  return avgWeightedVolume * multiplier;
}

// Tunes the magnitude of the goalie score so it sits in roughly the same range
// as the skater score. Lower = scores stay smaller; raise if goalies look
// underweighted on the leaderboard.
const GOALIE_VOLUME_SCALE = 1 / 6;

export function computeGoalieRivalryScore(input: GoalieRivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;
  if (input.gamesShared === 0) return 0;
  if (input.skaterShots === 0) return 0;

  // Weighted volume of meaningful interactions: every shot is a contest, every
  // goal/assist while sharing ice is a beat against this goalie. Unlike the
  // skater formula (which is per-game so intensity isn't drowned out by long
  // careers), goalie rivalries accumulate — a long history of shots faced is
  // exactly what makes a goalie/shooter rivalry meaningful. So we use totals.
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

  return weightedVolume * GOALIE_VOLUME_SCALE * multiplier;
}
