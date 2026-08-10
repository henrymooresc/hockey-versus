import { describe, it, expect } from "vitest";
import {
  computeSkaterRivalryScore,
  computeGoalieRivalryScore,
  computePairRivalryScore,
  isSmallSample,
  PRIOR_GAMES,
  type SkaterRivalryInput,
  type GoalieRivalryInput,
} from "./rivalry-score";

const baseSkaterInput: SkaterRivalryInput = {
  toiSharedSeconds: 3600, // 60 minutes
  gamesShared: 10,
  hitsByA: 5,
  hitsByB: 4,
  blocksByA: 3,
  blocksByB: 2,
  penaltyMinutesA: 2,
  penaltyMinutesB: 2,
  faceoffWinsA: 10,
  faceoffWinsB: 10,
  playerAGoals: 3,
  playerAAssists: 5,
  playerAShots: 20,
  playerBGoals: 4,
  playerBAssists: 4,
  playerBShots: 18,
  winsA: 5,
  winsB: 5,
};

describe("computeSkaterRivalryScore", () => {
  it("returns 0 when no shared TOI", () => {
    expect(computeSkaterRivalryScore({ ...baseSkaterInput, toiSharedSeconds: 0 })).toBe(0);
  });

  it("returns 0 when no shared games", () => {
    expect(computeSkaterRivalryScore({ ...baseSkaterInput, gamesShared: 0 })).toBe(0);
  });

  it("returns a positive score for active rivalry", () => {
    expect(computeSkaterRivalryScore(baseSkaterInput)).toBeGreaterThan(0);
  });

  it("scores higher when stats are more balanced", () => {
    const balanced: SkaterRivalryInput = {
      ...baseSkaterInput,
      playerAGoals: 5,
      playerBGoals: 5,
      hitsByA: 5,
      hitsByB: 5,
    };
    const unbalanced: SkaterRivalryInput = {
      ...baseSkaterInput,
      playerAGoals: 10,
      playerBGoals: 0,
      hitsByA: 10,
      hitsByB: 0,
    };
    expect(computeSkaterRivalryScore(balanced)).toBeGreaterThan(
      computeSkaterRivalryScore(unbalanced)
    );
  });

  it("scores higher with more interactions per game", () => {
    const highVolume: SkaterRivalryInput = {
      ...baseSkaterInput,
      playerAGoals: 6,
      playerAAssists: 10,
      playerBGoals: 6,
      playerBAssists: 10,
    };
    expect(computeSkaterRivalryScore(highVolume)).toBeGreaterThan(
      computeSkaterRivalryScore(baseSkaterInput)
    );
  });

  it("returns 0 when all categories are zero", () => {
    const empty: SkaterRivalryInput = {
      toiSharedSeconds: 3600,
      gamesShared: 10,
      hitsByA: 0, hitsByB: 0,
      blocksByA: 0, blocksByB: 0,
      penaltyMinutesA: 0, penaltyMinutesB: 0,
      faceoffWinsA: 0, faceoffWinsB: 0,
      playerAGoals: 0, playerAAssists: 0, playerAShots: 0,
      playerBGoals: 0, playerBAssists: 0, playerBShots: 0,
      winsA: 0, winsB: 0,
    };
    expect(computeSkaterRivalryScore(empty)).toBe(0);
  });
});

describe("computeGoalieRivalryScore", () => {
  const baseGoalieInput: GoalieRivalryInput = {
    toiSharedSeconds: 3600,
    gamesShared: 6,
    skaterShots: 20,
    skaterGoals: 5,
    skaterAssists: 4,
    winsA: 3,
    winsB: 3,
  };

  it("returns 0 when no shared TOI", () => {
    expect(computeGoalieRivalryScore({ ...baseGoalieInput, toiSharedSeconds: 0 })).toBe(0);
  });

  it("returns 0 when no shared games", () => {
    expect(computeGoalieRivalryScore({ ...baseGoalieInput, gamesShared: 0 })).toBe(0);
  });

  it("returns 0 when no shots", () => {
    expect(computeGoalieRivalryScore({ ...baseGoalieInput, skaterShots: 0 })).toBe(0);
  });

  it("returns a positive score for active matchup", () => {
    expect(computeGoalieRivalryScore(baseGoalieInput)).toBeGreaterThan(0);
  });

  it("scores higher when outcome is more balanced", () => {
    const balanced: GoalieRivalryInput = {
      ...baseGoalieInput,
      skaterGoals: 10, // 50% save rate — even contest
      skaterShots: 20,
    };
    const dominated: GoalieRivalryInput = {
      ...baseGoalieInput,
      skaterGoals: 0, // goalie shuts out skater completely
      skaterShots: 20,
    };
    expect(computeGoalieRivalryScore(balanced)).toBeGreaterThan(
      computeGoalieRivalryScore(dominated)
    );
  });

  it("scores higher with more interactions per game", () => {
    const highVolume: GoalieRivalryInput = {
      ...baseGoalieInput,
      skaterShots: 60,
      skaterGoals: 15,
    };
    expect(computeGoalieRivalryScore(highVolume)).toBeGreaterThan(
      computeGoalieRivalryScore(baseGoalieInput)
    );
  });

  it("rewards assists on goals scored on this goalie", () => {
    const withAssists = computeGoalieRivalryScore({ ...baseGoalieInput, skaterAssists: 10 });
    const withoutAssists = computeGoalieRivalryScore({ ...baseGoalieInput, skaterAssists: 0 });
    expect(withAssists).toBeGreaterThan(withoutAssists);
  });

  it("shares a scale with a comparable skater rivalry", () => {
    // High-volume goalie matchup: 30 GP, 200 shots, 20 goals
    const goalie = computeGoalieRivalryScore({
      toiSharedSeconds: 36000,
      gamesShared: 30,
      skaterShots: 200,
      skaterGoals: 20,
      skaterAssists: 25,
      winsA: 14,
      winsB: 16,
    });
    // High-volume skater matchup at the same GP
    const skater = computeSkaterRivalryScore({
      ...baseSkaterInput,
      gamesShared: 30,
      playerAGoals: 12,
      playerAAssists: 18,
      playerBGoals: 12,
      playerBAssists: 18,
    });
    // Both formulas are per-game, so comparable matchups land within a third of
    // each other. The old totals-based goalie score broke this badly.
    expect(goalie).toBeGreaterThan(skater * 0.67);
    expect(goalie).toBeLessThan(skater * 1.5);
  });

  it("does not grow just because a rivalry spans more games", () => {
    const perGame = { shots: 7, goals: 0.7, assists: 0.8 };
    const short = computeGoalieRivalryScore({
      toiSharedSeconds: 12000, gamesShared: 10,
      skaterShots: perGame.shots * 10, skaterGoals: 7, skaterAssists: 8,
      winsA: 5, winsB: 5,
    });
    const long = computeGoalieRivalryScore({
      toiSharedSeconds: 48000, gamesShared: 40,
      skaterShots: perGame.shots * 40, skaterGoals: 28, skaterAssists: 32,
      winsA: 20, winsB: 20,
    });
    // Same intensity per game, so the same score regardless of length.
    expect(long).toBeCloseTo(short, 6);
  });
});

describe("computePairRivalryScore", () => {
  it("uses the skater formula when neither player is a goalie", () => {
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "C",
      positionB: "D",
    });
    expect(score).toBeGreaterThan(0);
  });

  it("treats a null position as a skater", () => {
    const asSkaters = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "C",
      positionB: "D",
    });
    const asNulls = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: null,
      positionB: null,
    });
    expect(asNulls).toBe(asSkaters);
  });

  it("returns 0 when both players are goalies", () => {
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "G",
      positionB: "G",
    });
    expect(score).toBe(0);
  });

  it("scores player B as the shooter when player A is the goalie", () => {
    const base = { ...baseSkaterInput, positionA: "G", positionB: "R" } as const;
    // B is the shooter, so B's shots move the score and A's do not.
    expect(computePairRivalryScore({ ...base, playerBShots: 40 })).not.toBe(
      computePairRivalryScore(base)
    );
    expect(computePairRivalryScore({ ...base, playerAShots: 40 })).toBe(
      computePairRivalryScore(base)
    );
  });

  it("scores player A as the shooter when player B is the goalie", () => {
    const base = { ...baseSkaterInput, positionA: "L", positionB: "G" } as const;
    expect(computePairRivalryScore({ ...base, playerAShots: 40 })).not.toBe(
      computePairRivalryScore(base)
    );
    expect(computePairRivalryScore({ ...base, playerBShots: 40 })).toBe(
      computePairRivalryScore(base)
    );
  });

  it("gives the same score whichever side the goalie sits on", () => {
    const goalieIsA = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "G",
      positionB: "C",
    });
    const goalieIsB = computePairRivalryScore({
      ...baseSkaterInput,
      playerAShots: baseSkaterInput.playerBShots,
      playerAGoals: baseSkaterInput.playerBGoals,
      playerAAssists: baseSkaterInput.playerBAssists,
      positionA: "C",
      positionB: "G",
    });
    expect(goalieIsB).toBeCloseTo(goalieIsA, 10);
  });
});

describe("small-sample regression", () => {
  /** Perfectly balanced, so the balance multiplier is 1 and volume drives the score. */
  function balancedPair(gamesShared: number, per: {
    points: number; penalties: number; hits: number;
    blocks: number; faceoffs: number; shots: number;
  }): SkaterRivalryInput {
    return {
      toiSharedSeconds: gamesShared * 600,
      gamesShared,
      hitsByA: per.hits, hitsByB: per.hits,
      blocksByA: per.blocks, blocksByB: per.blocks,
      penaltyMinutesA: per.penalties, penaltyMinutesB: per.penalties,
      faceoffWinsA: per.faceoffs, faceoffWinsB: per.faceoffs,
      playerAGoals: per.points, playerAAssists: 0, playerAShots: per.shots,
      playerBGoals: per.points, playerBAssists: 0, playerBShots: per.shots,
      winsA: Math.floor(gamesShared / 2), winsB: Math.floor(gamesShared / 2),
    };
  }

  // 2 shared games, very high raw intensity (19.5 weighted volume per game)
  const shortHotPair = balancedPair(2, {
    points: 1, penalties: 0, hits: 3, blocks: 1, faceoffs: 1, shots: 2,
  });
  // 30 shared games, strong but lower raw intensity (9.5 per game)
  const longStrongPair = balancedPair(30, {
    points: 5, penalties: 3, hits: 20, blocks: 8, faceoffs: 10, shots: 15,
  });

  const asSkaters = (input: SkaterRivalryInput) =>
    computePairRivalryScore({ ...input, positionA: "C", positionB: "D" });

  it("ranks a long rivalry above a hot two-game sample", () => {
    // Raw per-game intensity favours the short sample...
    expect(computeSkaterRivalryScore(shortHotPair)).toBeGreaterThan(
      computeSkaterRivalryScore(longStrongPair)
    );
    // ...but the ranking score does not.
    expect(asSkaters(longStrongPair)).toBeGreaterThan(asSkaters(shortHotPair));
  });

  it("pulls a small sample well below its raw score", () => {
    const raw = computeSkaterRivalryScore(shortHotPair);
    expect(asSkaters(shortHotPair)).toBeLessThan(raw * 0.6);
  });

  it("barely moves a long history", () => {
    const raw = computeSkaterRivalryScore(longStrongPair);
    const ranked = asSkaters(longStrongPair);
    expect(ranked).toBeGreaterThan(raw * 0.85);
    expect(ranked).toBeLessThan(raw);
  });

  it("still rewards a short history that is genuinely elite", () => {
    const eliteShort = balancedPair(4, {
      points: 3, penalties: 2, hits: 8, blocks: 3, faceoffs: 4, shots: 6,
    });
    const quietLong = balancedPair(40, {
      points: 0, penalties: 0, hits: 2, blocks: 1, faceoffs: 1, shots: 2,
    });
    expect(asSkaters(eliteShort)).toBeGreaterThan(asSkaters(quietLong));
  });

  it("keeps a pair with no recorded interactions below a typical pair", () => {
    const empty = balancedPair(4, {
      points: 0, penalties: 0, hits: 0, blocks: 0, faceoffs: 0, shots: 0,
    });
    const typical = balancedPair(4, {
      points: 1, penalties: 0, hits: 2, blocks: 1, faceoffs: 2, shots: 2,
    });
    expect(asSkaters(empty)).toBeLessThan(asSkaters(typical));
  });

  it("regresses goalie pairs too", () => {
    const shortHistory = { ...baseSkaterInput, gamesShared: 2 };
    const raw = computeGoalieRivalryScore({
      toiSharedSeconds: shortHistory.toiSharedSeconds,
      gamesShared: 2,
      skaterShots: shortHistory.playerAShots,
      skaterGoals: shortHistory.playerAGoals,
      skaterAssists: shortHistory.playerAAssists,
      winsA: shortHistory.winsA,
      winsB: shortHistory.winsB,
    });
    const ranked = computePairRivalryScore({
      ...shortHistory,
      positionA: "L",
      positionB: "G",
    });
    expect(ranked).toBeLessThan(raw);
  });

  it("rewards the longer goalie history at equal per-game intensity", () => {
    // Identical rates, different lengths. The raw scores tie; the ranking score
    // trusts the longer record more, so it regresses less toward the mean.
    const rank = (games: number) =>
      computePairRivalryScore({
        ...baseSkaterInput,
        toiSharedSeconds: games * 600,
        gamesShared: games,
        playerAShots: 6 * games,
        playerAGoals: games,
        playerAAssists: games,
        winsA: games / 2,
        winsB: games / 2,
        positionA: "L",
        positionB: "G",
      });
    const raw = (games: number) =>
      computeGoalieRivalryScore({
        toiSharedSeconds: games * 600,
        gamesShared: games,
        skaterShots: 6 * games,
        skaterGoals: games,
        skaterAssists: games,
        winsA: games / 2,
        winsB: games / 2,
      });

    expect(raw(4)).toBeCloseTo(raw(30), 6);
    expect(rank(30)).toBeGreaterThan(rank(4));
  });

  it("marks a short history as a small sample", () => {
    expect(isSmallSample(PRIOR_GAMES - 1)).toBe(true);
    expect(isSmallSample(PRIOR_GAMES)).toBe(false);
    expect(isSmallSample(PRIOR_GAMES + 1)).toBe(false);
  });
});

describe("penalty severity", () => {
  /** Same number of penalties, different severity. */
  const withPim = (minutesEach: number): SkaterRivalryInput => ({
    ...baseSkaterInput,
    penaltyMinutesA: minutesEach,
    penaltyMinutesB: minutesEach,
  });

  it("scores a fight above a minor", () => {
    // One 5-minute fighting major each, against one 2-minute minor each.
    expect(computeSkaterRivalryScore(withPim(5))).toBeGreaterThan(
      computeSkaterRivalryScore(withPim(2))
    );
  });

  it("scores a misconduct above a fight", () => {
    expect(computeSkaterRivalryScore(withPim(10))).toBeGreaterThan(
      computeSkaterRivalryScore(withPim(5))
    );
  });

  it("keeps a minor worth what the old per-penalty weight was", () => {
    // The old formula scored 4 per penalty. At 2 per minute a 2-minute minor
    // still contributes 4, so ordinary pairs are unaffected by the change.
    const oneMinorEach = withPim(2);
    const noPenalties = withPim(0);
    const parts = (i: SkaterRivalryInput) => computeSkaterRivalryScore(i);
    // Difference comes only from the penalty term and the balance multiplier,
    // so assert the direction and that it is not a runaway.
    expect(parts(oneMinorEach)).toBeGreaterThan(parts(noPenalties));
    expect(parts(oneMinorEach)).toBeLessThan(parts(noPenalties) * 1.5);
  });

  it("still treats a lopsided penalty record as less of a rivalry", () => {
    const even = { ...baseSkaterInput, penaltyMinutesA: 5, penaltyMinutesB: 5 };
    const lopsided = { ...baseSkaterInput, penaltyMinutesA: 10, penaltyMinutesB: 0 };
    expect(computeSkaterRivalryScore(even)).toBeGreaterThan(
      computeSkaterRivalryScore(lopsided)
    );
  });
});
