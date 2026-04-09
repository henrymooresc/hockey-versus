export interface RivalryInput {
  toiSharedSeconds: number;
  hitsByA: number;
  hitsByB: number;
  penaltiesByA: number;
  penaltiesByB: number;
  faceoffWinsA: number;
  faceoffWinsB: number;
  playerAGoals: number;
  playerAAssists: number;
  playerBGoals: number;
  playerBAssists: number;
  goalsForA: number;
  goalsForB: number;
  winsA: number;
  winsB: number;
}

export function computeRivalryScore(input: RivalryInput): number {
  if (input.toiSharedSeconds === 0) return 0;

  const interactions =
    input.hitsByA +
    input.hitsByB +
    input.penaltiesByA +
    input.penaltiesByB +
    input.faceoffWinsA +
    input.faceoffWinsB +
    input.playerAGoals +
    input.playerBGoals;

  const toiMinutes = input.toiSharedSeconds / 60;

  // Geometric mean of raw volume and per-minute rate:
  // interactions / sqrt(toiMinutes) = sqrt(interactions * interactions/toiMinutes)
  // This rewards both high total interactions AND high interaction rate,
  // preventing low-TOI matchups with few interactions from scoring high.
  const base = interactions / Math.sqrt(toiMinutes);

  const categories: [number, number][] = [
    [input.hitsByA, input.hitsByB],
    [input.playerAGoals + input.playerAAssists, input.playerBGoals + input.playerBAssists],
    [input.goalsForA, input.goalsForB],
    [input.winsA, input.winsB],
  ];

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
  const evennessMultiplier = 2 * evenness - 1;

  return base * evennessMultiplier;
}
