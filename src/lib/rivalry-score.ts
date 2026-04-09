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
  let balanceSum = 0;
  let balanceCount = 0;

  for (const [a, b] of categories) {
    const total = a + b;
    if (total === 0) continue;
    balanceSum += 1 - Math.abs(a - b) / total;
    balanceCount++;
  }

  if (balanceCount === 0) return 0;

  const evenness = balanceSum / balanceCount;
  return 2 * evenness - 1;
}

export function computeSkaterRivalryScore(input: SkaterRivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;

  const interactions =
    input.hitsByA +
    input.hitsByB +
    input.blocksByA +
    input.blocksByB +
    input.penaltiesByA +
    input.penaltiesByB +
    input.faceoffWinsA +
    input.faceoffWinsB +
    input.playerAGoals +
    input.playerBGoals;

  const toiMinutes = input.toiSharedSeconds / 60;
  const base = interactions / Math.sqrt(toiMinutes);

  const evennessMultiplier = computeBalance([
    [input.playerAGoals + input.playerAAssists, input.playerBGoals + input.playerBAssists],
    [input.playerAShots, input.playerBShots],
    [input.hitsByA, input.hitsByB],
    [input.blocksByA, input.blocksByB],
    [input.penaltiesByA, input.penaltiesByB],
    [input.winsA, input.winsB],
  ]);

  return base * evennessMultiplier;
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
