import { describe, it, expect } from "vitest";
import {
  computeSkaterRivalryScore,
  computeGoalieRivalryScore,
  computePairRivalryScore,
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
  penaltiesByA: 2,
  penaltiesByB: 2,
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
      penaltiesByA: 0, penaltiesByB: 0,
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

  it("falls within the same order of magnitude as a comparable skater rivalry", () => {
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
    // Goalie should be at least within half of skater (was ~1/3 in the old formula)
    expect(goalie).toBeGreaterThan(skater * 0.5);
  });
});

describe("computePairRivalryScore", () => {
  it("uses the skater formula when neither player is a goalie", () => {
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "C",
      positionB: "D",
    });
    expect(score).toBe(computeSkaterRivalryScore(baseSkaterInput));
  });

  it("treats a null position as a skater", () => {
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: null,
      positionB: null,
    });
    expect(score).toBe(computeSkaterRivalryScore(baseSkaterInput));
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
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "G",
      positionB: "R",
    });
    expect(score).toBe(
      computeGoalieRivalryScore({
        toiSharedSeconds: baseSkaterInput.toiSharedSeconds,
        gamesShared: baseSkaterInput.gamesShared,
        skaterShots: baseSkaterInput.playerBShots,
        skaterGoals: baseSkaterInput.playerBGoals,
        skaterAssists: baseSkaterInput.playerBAssists,
        winsA: baseSkaterInput.winsA,
        winsB: baseSkaterInput.winsB,
      })
    );
  });

  it("scores player A as the shooter when player B is the goalie", () => {
    const score = computePairRivalryScore({
      ...baseSkaterInput,
      positionA: "L",
      positionB: "G",
    });
    expect(score).toBe(
      computeGoalieRivalryScore({
        toiSharedSeconds: baseSkaterInput.toiSharedSeconds,
        gamesShared: baseSkaterInput.gamesShared,
        skaterShots: baseSkaterInput.playerAShots,
        skaterGoals: baseSkaterInput.playerAGoals,
        skaterAssists: baseSkaterInput.playerAAssists,
        winsA: baseSkaterInput.winsA,
        winsB: baseSkaterInput.winsB,
      })
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
