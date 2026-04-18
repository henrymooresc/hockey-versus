import { describe, it, expect } from "vitest";
import {
  computeSkaterRivalryScore,
  computeGoalieRivalryScore,
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
    skaterShots: 20,
    skaterGoals: 5,
    winsA: 3,
    winsB: 3,
  };

  it("returns 0 when no shared TOI", () => {
    expect(computeGoalieRivalryScore({ ...baseGoalieInput, toiSharedSeconds: 0 })).toBe(0);
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
});
