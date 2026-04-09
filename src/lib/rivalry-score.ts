export interface SkaterRivalryInput {
  toiSharedSeconds: number;
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
  /** Skater's individual shots on this goalie */
  skaterShots: number;
  /** Skater's goals scored on this goalie */
  skaterGoals: number;
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

export function computeSkaterRivalryScore(input: SkaterRivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;

  const ptsA = input.playerAGoals + input.playerAAssists;
  const ptsB = input.playerBGoals + input.playerBAssists;

  const weightedVolume =
    CATEGORY_WEIGHTS.points * (ptsA + ptsB) +
    CATEGORY_WEIGHTS.penalties * (input.penaltiesByA + input.penaltiesByB) +
    CATEGORY_WEIGHTS.hits * (input.hitsByA + input.hitsByB) +
    CATEGORY_WEIGHTS.blocks * (input.blocksByA + input.blocksByB) +
    CATEGORY_WEIGHTS.faceoffs * (input.faceoffWinsA + input.faceoffWinsB) +
    CATEGORY_WEIGHTS.shots * (input.playerAShots + input.playerBShots);

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

  return weightedVolume * multiplier;
}

export function computeGoalieRivalryScore(input: GoalieRivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;
  if (input.skaterShots === 0) return 0;

  // Interactions are total shots faced
  const interactions = input.skaterShots;

  const toiMinutes = input.toiSharedSeconds / 60;
  const base = interactions / Math.sqrt(toiMinutes);

  // Balance: goals scored vs saves made — a good rivalry has the skater
  // beating the goalie sometimes but not always
  const saves = input.skaterShots - input.skaterGoals;
  const evennessMultiplier = computeBalance([
    [input.skaterGoals, saves],
    [input.winsA, input.winsB],
  ]);

  return base * evennessMultiplier;
}

/** @deprecated Use computeSkaterRivalryScore or computeGoalieRivalryScore */
export function computeRivalryScore(input: SkaterRivalryInput): number {
  return computeSkaterRivalryScore(input);
}
